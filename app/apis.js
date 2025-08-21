	
	// AIC API (Art Institute of Chicago)
    async function loadAICData() {
      const results = [];
      const totalPages = 3;
      
      for (let page = 1; page <= totalPages; page++) {
        try {
          const res = await fetch(`https://api.artic.edu/api/v1/artworks?page=${page}&limit=100&fields=id,title,image_id,artist_display,date_display,date_start,classification_title,department_title,place_of_origin,medium_display,dimensions,credit_line,main_reference_number,is_on_view,is_public_domain,is_zoomable,gallery_title`);
          
          if (!res.ok) continue;
          const data = await res.json();
          
          const filteredData = data.data.filter(artwork => 
            artwork.image_id && artwork.title && artwork.artist_display
          ).map(artwork => ({
            ...artwork,
            source: 'aic',
            imageUrl: `https://www.artic.edu/iiif/2/${artwork.image_id}/full/1024,/0/default.jpg`
          }));
          
          results.push(...filteredData);
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.error('AIC API Error:', error);
        }
      }
      
      return results;
    }

// MET API (Metropolitan Museum) mit CORS-Fehler-Behandlung
async function loadMETData() {
  const results = [];
  let corsProxyUrl = 'https://api.allorigins.win/get?url='; // CORS-Proxy als Fallback
  
  try {
    // Hole Department IDs
    const deptRes = await fetch('https://collectionapi.metmuseum.org/public/collection/v1/departments');
    const departments = await deptRes.json();
    
    // Hole Object IDs für Gemälde und Skulpturen
    const objectRes = await fetch('https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=painting');
    const objectData = await objectRes.json();
    
    if (objectData.objectIDs) {
      // Nehme nur die ersten 200 Objekte
      const limitedIds = objectData.objectIDs.slice(0, 200);
      
      for (let i = 0; i < limitedIds.length; i++) {
        try {
          // Versuche zuerst die direkte API-Anfrage
          let objData = await fetchWithFallback(limitedIds[i]);
          
          if (objData && objData.primaryImage && objData.title && objData.artistDisplayName) {
            results.push({
              id: objData.objectID,
              title: objData.title,
              image_id: objData.objectID,
              artist_display: objData.artistDisplayName,
              date_display: objData.objectDate,
              date_start: objData.objectBeginDate,
              classification_title: objData.objectName,
              department_title: objData.department,
              place_of_origin: objData.country,
              medium_display: objData.medium,
              dimensions: objData.dimensions,
              credit_line: objData.creditLine,
              is_public_domain: objData.isPublicDomain,
              is_zoomable: true,
              source: 'met',
              imageUrl: objData.primaryImage
            });
          }
          
          // Pause zwischen Anfragen
          await new Promise(resolve => setTimeout(resolve, 50));
          
        } catch (error) {
          console.error(`MET Object Error for ID ${limitedIds[i]}:`, error);
          // Überspringe problematische Objekte und mache weiter
          continue;
        }
      }
    }
  } catch (error) {
    console.error('MET API Error:', error);
  }
  
  return results;
}

// Hilfsfunktion mit funktionierenden CORS-Proxies
async function fetchWithFallback(objectId) {
  const originalUrl = `https://collectionapi.metmuseum.org/public/collection/v1/objects/${objectId}`;
  
  // Liste funktionierender CORS-Proxies (für file:// Protokoll)
  const proxies = [
    // Proxy 1: corsproxy.io
    url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    // Proxy 2: cors-proxy.htmldriven.com
    url => `https://cors-proxy.htmldriven.com/?url=${encodeURIComponent(url)}`,
    // Proxy 3: api.codetabs.com
    url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
  ];
  
  // Versuche zuerst ohne Proxy (falls lokaler Server läuft)
  try {
    const response = await fetch(originalUrl);
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    // CORS-Fehler erwartet bei file:// Protokoll
  }
  
  // Versuche verschiedene Proxies
  for (let i = 0; i < proxies.length; i++) {
    try {
      const proxyUrl = proxies[i](originalUrl);
      console.log(`Trying proxy ${i + 1} for object ${objectId}`);
      
      const response = await fetch(proxyUrl);
      if (response.ok) {
        let data;
        const contentType = response.headers.get('content-type');
        
        if (i === 2) { // codetabs proxy
          const text = await response.text();
          data = JSON.parse(text);
        } else {
          data = await response.json();
        }
        
        console.log(`Proxy ${i + 1} successful for object ${objectId}`);
        return data;
      }
    } catch (error) {
      console.log(`Proxy ${i + 1} failed for object ${objectId}:`, error.message);
      
      // Warte zwischen Proxy-Versuchen
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.error(`All proxies failed for object ${objectId}`);
  return null;
}

// Alternative: Batch-Verarbeitung mit Retry-Logik
async function loadMETDataWithRetry() {
  const results = [];
  const maxRetries = 3;
  
  try {
    const objectRes = await fetch('https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=painting');
    const objectData = await objectRes.json();
    
    if (objectData.objectIDs) {
      const limitedIds = objectData.objectIDs.slice(0, 200);
      
      // Verarbeite in kleineren Batches
      const batchSize = 10;
      for (let i = 0; i < limitedIds.length; i += batchSize) {
        const batch = limitedIds.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (id) => {
          for (let retry = 0; retry < maxRetries; retry++) {
            try {
              const objData = await fetchWithFallback(id);
              if (objData && objData.primaryImage && objData.title && objData.artistDisplayName) {
                return {
                  id: objData.objectID,
                  title: objData.title,
                  image_id: objData.objectID,
                  artist_display: objData.artistDisplayName,
                  date_display: objData.objectDate,
                  date_start: objData.objectBeginDate,
                  classification_title: objData.objectName,
                  department_title: objData.department,
                  place_of_origin: objData.country,
                  medium_display: objData.medium,
                  dimensions: objData.dimensions,
                  credit_line: objData.creditLine,
                  is_public_domain: objData.isPublicDomain,
                  is_zoomable: true,
                  source: 'met',
                  imageUrl: objData.primaryImage
                };
              }
              return null;
            } catch (error) {
              console.log(`Retry ${retry + 1} failed for object ${id}`);
              if (retry < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000 * (retry + 1)));
              }
            }
          }
          return null;
        });
        
        const batchResults = await Promise.allSettled(batchPromises);
        batchResults.forEach(result => {
          if (result.status === 'fulfilled' && result.value) {
            results.push(result.value);
          }
        });
        
        // Pause zwischen Batches
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  } catch (error) {
    console.error('MET API Error:', error);
  }
  
  return results;
}

    // MET API (Metropolitan Museum)
    async function loadMETDataOld() {
      const results = [];
      
      try {
        // Hole Department IDs
        const deptRes = await fetch('https://collectionapi.metmuseum.org/public/collection/v1/departments');
        const departments = await deptRes.json();
        
        // Hole Object IDs für Gemälde und Skulpturen
        const objectRes = await fetch('https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=painting');
        const objectData = await objectRes.json();
        
        if (objectData.objectIDs) {
          // Nehme nur die ersten 200 Objekte
          const limitedIds = objectData.objectIDs.slice(0, 200);
          
          for (let i = 0; i < limitedIds.length; i++) {
            try {
              const objRes = await fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${limitedIds[i]}`);
              const objData = await objRes.json();
              
              if (objData.primaryImage && objData.title && objData.artistDisplayName) {
                results.push({
                  id: objData.objectID,
                  title: objData.title,
                  image_id: objData.objectID,
                  artist_display: objData.artistDisplayName,
                  date_display: objData.objectDate,
                  date_start: objData.objectBeginDate,
                  classification_title: objData.objectName,
                  department_title: objData.department,
                  place_of_origin: objData.country,
                  medium_display: objData.medium,
                  dimensions: objData.dimensions,
                  credit_line: objData.creditLine,
                  is_public_domain: objData.isPublicDomain,
                  is_zoomable: true,
                  source: 'met',
                  imageUrl: objData.primaryImage
                });
              }
              await new Promise(resolve => setTimeout(resolve, 50));
            } catch (error) {
              console.error('MET Object Error:', error);
            }
          }
        }
      } catch (error) {
        console.error('MET API Error:', error);
      }
      
      return results;
    }

    // Cleveland Museum of Art API Integration
    async function loadClevelandData() {
      const results = [];
      const totalPages = 2;
      
      try {
        for (let page = 1; page <= totalPages; page++) {
          const res = await fetch(`https://openaccess-api.clevelandart.org/api/artworks/?limit=100&page=${page}&has_image=1`);
          
          if (!res.ok) continue;
          const data = await res.json();
          
          const filteredData = data.data.filter(artwork => 
            artwork.images?.web?.url && 
            artwork.title && 
            (artwork.creators?.[0]?.description || artwork.culture?.[0])
          ).map(artwork => ({
            id: artwork.id,
            title: artwork.title,
            image_id: artwork.id,
            artist_display: artwork.creators?.[0]?.description || artwork.culture?.[0] || 'Unbekannter Künstler',
            date_display: artwork.creation_date || '',
            date_start: artwork.creation_date_earliest || 0,
            classification_title: artwork.type || 'Artwork',
            department_title: artwork.department || 'Cleveland Museum of Art',
            place_of_origin: artwork.culture?.[0] || artwork.technique?.[0] || '',
            medium_display: artwork.technique?.[0] || artwork.materials?.[0] || '',
            dimensions: artwork.measurements?.[0] || '',
            credit_line: artwork.copyright || 'Public Domain',
            is_public_domain: true, // Cleveland stellt nur gemeinfreie Werke zur Verfügung
            is_zoomable: true,
            source: 'cleveland',
            imageUrl: artwork.images.web.url.replace('/crop/', '/full/').replace('!200,200', '!1200,1200')
          }));
          
          results.push(...filteredData);
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch (error) {
        console.error('Cleveland API Error:', error);
      }
      
      return results;
    }

    // Rijksmuseum API
    async function loadRijksData() {
      const results = [];
      const apiKey = '0fiuZFh4'; // Public API key
      const totalPages = 2;
      
      try {
        for (let page = 1; page <= totalPages; page++) {
          const res = await fetch(`https://www.rijksmuseum.nl/api/en/collection?key=${apiKey}&p=${page}&ps=100&imgonly=true&toppieces=true`);
          const data = await res.json();
          
          if (data.artObjects) {
            const filteredData = data.artObjects.filter(artwork => 
              artwork.webImage && artwork.title && artwork.principalOrFirstMaker
            ).map(artwork => ({
              id: artwork.id,
              title: artwork.title,
              image_id: artwork.id,
              artist_display: artwork.principalOrFirstMaker,
              date_display: artwork.longTitle.split(', ').pop(),
              date_start: artwork.dating?.yearEarly || 0,
              classification_title: artwork.objectTypes?.[0] || 'Artwork',
              department_title: 'Rijksmuseum',
              place_of_origin: artwork.productionPlaces?.[0] || 'Netherlands',
              medium_display: artwork.materials?.[0] || '',
              dimensions: '',
              credit_line: '',
              is_public_domain: true,
              is_zoomable: true,
              source: 'rijks',
              imageUrl: artwork.webImage.url.replace('=s0', '=s1000')
            }));
            
            results.push(...filteredData);
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
      } catch (error) {
        console.error('Rijksmuseum API Error:', error);
      }
      
      return results;
    }
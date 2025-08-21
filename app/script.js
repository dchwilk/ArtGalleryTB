let artworks = [];
    let allArtworks = [];
    let currentIndex = 0;
    let timer = 30;
    let infoVisible = false;
    let infoHoldStart = 0;
    let interval;
    let randomizedOrder = [];
	
	// Fisher-Yates Shuffle
    function shuffleArray(array) {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    }
	
	function createRandomizedOrder() {
      const indices = Array.from({length: artworks.length}, (_, i) => i);
      randomizedOrder = shuffleArray(indices);
      currentIndex = 0;
    }
	
	
	function getSelectedSources() {
      const sources = [];
      if (document.getElementById('sourceAIC').checked) sources.push('aic');
      if (document.getElementById('sourceMET').checked) sources.push('met');
      if (document.getElementById('sourceRijks').checked) sources.push('rijks');
      if (document.getElementById('sourceCleveland').checked) sources.push('cleveland');
      return sources;
    }
	
	function getSelectedFilters() {
      const filters = {
        types: [],
        periods: [],
        departments: [],
        properties: []
      };
      
      // Kunstarten
      if (document.getElementById('sourcePaintings').checked) {
        filters.types.push('painting', 'Painting');
      }
      if (document.getElementById('sourcePhotographs').checked) {
        filters.types.push('photograph', 'Photograph', 'photography');
      }
      if (document.getElementById('sourceSculpture').checked) {
        filters.types.push('sculpture', 'Sculpture');
      }
      if (document.getElementById('sourceDrawings').checked) {
        filters.types.push('drawing', 'Drawing', 'print', 'Print');
      }
      if (document.getElementById('sourceDecorative').checked) {
        filters.types.push('decorative', 'Decorative', 'vessel', 'furniture');
      }
      
      // Epochen
      const periods = [
        {id: 'periodAncient', start: -3000, end: 500},
        {id: 'periodMedieval', start: 500, end: 1400},
        {id: 'periodRenaissance', start: 1400, end: 1600},
        {id: 'periodBaroque', start: 1600, end: 1750},
        {id: 'periodModern', start: 1750, end: 1950},
        {id: 'periodContemporary', start: 1950, end: 2030}
      ];
      
      periods.forEach(period => {
        if (document.getElementById(period.id).checked) {
          filters.periods.push({start: period.start, end: period.end});
        }
      });
      
      // Abteilungen
      if (document.getElementById('deptEuropean').checked) {
        filters.departments.push('European', 'Painting', 'Sculpture');
      }
      if (document.getElementById('deptAmerican').checked) {
        filters.departments.push('American');
      }
      if (document.getElementById('deptAsian').checked) {
        filters.departments.push('Asian', 'Arts of Asia');
      }
      if (document.getElementById('deptModern').checked) {
        filters.departments.push('Modern', 'Contemporary');
      }
      if (document.getElementById('deptContemporary').checked) {
        filters.departments.push('Contemporary');
      }
      
      // Eigenschaften
      if (document.getElementById('onlyPublicDomain').checked) {
        filters.properties.push('publicDomain');
      }
      if (document.getElementById('onlyHighRes').checked) {
        filters.properties.push('highRes');
      }
      if (document.getElementById('onlyWithImages').checked) {
        filters.properties.push('withImages');
      }
      
      return filters;
    }
	
	function filterArtworks() {
      const selectedFilters = getSelectedFilters();
      let filteredWorks = [...allArtworks];
      
      // Filter nach Kunstarten
      if (selectedFilters.types.length > 0) {
        filteredWorks = filteredWorks.filter(artwork => 
          selectedFilters.types.some(filter => 
            (artwork.classification_title && 
             artwork.classification_title.toLowerCase().includes(filter.toLowerCase())) ||
            (artwork.objectName && 
             artwork.objectName.toLowerCase().includes(filter.toLowerCase())) ||
            (artwork.objectTypes && 
             artwork.objectTypes.some(type => type.toLowerCase().includes(filter.toLowerCase())))
          )
        );
      }
      
      // Filter nach Epochen
      if (selectedFilters.periods.length > 0) {
        filteredWorks = filteredWorks.filter(artwork => {
          const startYear = artwork.date_start || artwork.objectBeginDate || artwork.dating?.yearEarly;
          if (!startYear) return false;
          return selectedFilters.periods.some(period => 
            startYear >= period.start && startYear <= period.end
          );
        });
      }
      
      // Filter nach Eigenschaften
      selectedFilters.properties.forEach(prop => {
        switch(prop) {
          case 'publicDomain':
            filteredWorks = filteredWorks.filter(artwork => 
              artwork.is_public_domain === true || artwork.isPublicDomain === true);
            break;
          case 'highRes':
            filteredWorks = filteredWorks.filter(artwork => 
              artwork.is_zoomable === true || artwork.hasImage === true);
            break;
          case 'withImages':
            filteredWorks = filteredWorks.filter(artwork => 
              artwork.image_id || artwork.primaryImage || artwork.hasImage);
            break;
        }
      });
      
      artworks = filteredWorks;
      createRandomizedOrder();
      document.getElementById('artworkCount').textContent = artworks.length;
    }

	
	// Aktualisierte loadAllArtworks Funktion
    async function loadAllArtworks() {
      loadingInfo.style.display = 'block';
      frame.style.display = 'none';
      
      allArtworks = [];
      const selectedSources = getSelectedSources();
      
      try {
        loadingInfo.textContent = 'Lade Daten von Museen...';
        
        if (selectedSources.includes('aic')) {
          loadingInfo.textContent = 'Lade Art Institute of Chicago...';
          const aicData = await loadAICData();
          allArtworks.push(...aicData);
        }
        
        if (selectedSources.includes('met')) {
          loadingInfo.textContent = 'Lade Metropolitan Museum...';
          const metData = await loadMETData();
          allArtworks.push(...metData);
        }
        
        if (selectedSources.includes('rijks')) {
          loadingInfo.textContent = 'Lade Rijksmuseum...';
          const rijksData = await loadRijksData();
          allArtworks.push(...rijksData);
        }
        
        if (selectedSources.includes('cleveland') && document.getElementById('sourceCleveland').checked) {
          loadingInfo.textContent = 'Lade Cleveland Museum...';
          const clevelandData = await loadClevelandData();
          allArtworks.push(...clevelandData);
        }
        
        console.log(`Insgesamt ${allArtworks.length} Kunstwerke geladen`);
        
        filterArtworks();
        
        if (artworks.length > 0) {
          loadingInfo.style.display = 'none';
          frame.style.display = 'flex';
          showArtwork();
          startSlideshow();
        } else {
          loadingInfo.textContent = 'Keine Kunstwerke gefunden. Bitte Filter anpassen.';
        }
      } catch (error) {
        console.error('Fehler beim Laden der Kunstwerke:', error);
        loadingInfo.textContent = 'Fehler beim Laden der Kunstwerke. Bitte neu laden.';
      }
    }
	
	function showArtwork() {
      if (!artworks.length || !randomizedOrder.length) return;
      
      const randomIndex = randomizedOrder[currentIndex % randomizedOrder.length];
      const artwork = artworks[randomIndex];
      
      // Bild je nach Quelle laden
      img.src = artwork.imageUrl || 
                (artwork.source === 'aic' ? `https://www.artic.edu/iiif/2/${artwork.image_id}/full/1024,/0/default.jpg` : 
                 artwork.source === 'met' ? artwork.primaryImage : 
                 artwork.source === 'rijks' ? artwork.webImage?.url.replace('=s0', '=s1000') : 
                 artwork.source === 'cleveland' ? artwork.imageUrl : '');
      
      // Source-spezifische Tags
      const sourceTag = artwork.source === 'aic' ? '<span class="tag aic">Art Institute Chicago</span>' :
                       artwork.source === 'met' ? '<span class="tag met">Metropolitan Museum</span>' :
                       artwork.source === 'rijks' ? '<span class="tag rijks">Rijksmuseum</span>' :
                       artwork.source === 'cleveland' ? '<span class="tag cleveland">Cleveland Museum</span>' : '';
      
      infoBox.innerHTML = `
        <div class="artwork-info">
          <div class="title-section">
            <strong>${artwork.title}</strong>
            ${artwork.date_display ? `<span class="date">(${artwork.date_display})</span>` : ''}
          </div>
          
          <div class="artist-section">
            ${artwork.artist_display || 'Unbekannter Künstler'}
          </div>
          
          <div class="details-section">
            ${artwork.place_of_origin ? `<div><em>Herkunft:</em> ${artwork.place_of_origin}</div>` : ''}
            ${artwork.medium_display ? `<div><em>Technik:</em> ${artwork.medium_display}</div>` : ''}
            ${artwork.dimensions ? `<div><em>Größe:</em> ${artwork.dimensions}</div>` : ''}
            ${artwork.credit_line ? `<div class="credit-line">${artwork.credit_line}</div>` : ''}
          </div>
          
          <div class="meta-section">
            ${sourceTag}
            ${artwork.department_title ? `<span class="tag">${artwork.department_title}</span>` : ''}
            ${artwork.is_on_view ? '<span class="tag on-view">Aktuell ausgestellt</span>' : ''}
            ${artwork.is_public_domain ? '<span class="tag public-domain">Gemeinfrei</span>' : ''}
            ${artwork.gallery_title ? `<span class="tag gallery">Galerie ${artwork.gallery_title}</span>` : ''}
          </div>
          
          <div class="source-section">
            <small>Quelle: ${artwork.source === 'aic' ? 'Art Institute of Chicago' : 
                           artwork.source === 'met' ? 'Metropolitan Museum' : 
                           artwork.source === 'rijks' ? 'Rijksmuseum' : 
                           artwork.source === 'cleveland' ? 'Cleveland Museum' : 'Unbekannt'}</small>
            ${artwork.id ? `<small>ID: ${artwork.id}</small>` : ''}
          </div>
        </div>
      `;
    }
	
	function startSlideshow() {
      clearInterval(interval);
      interval = setInterval(() => {
        currentIndex++;
        
        if (currentIndex >= randomizedOrder.length) {
          createRandomizedOrder();
        }
        
        showArtwork();
      }, timer * 1000);
      document.getElementById('timeLabel').textContent = timer;
    }
	
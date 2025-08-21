
    let matColors = ['#e3e0d3', '#cdc4a2', '#7b8579', '#45414a', '#d6d5d9', '#ffffff', '#000000', '#d0d0ff', '#ffe0e0'];
    let colorNames = ['Eierschale', 'Sand', 'Stein', 'Anthrazit', 'Hellgrau', 'Weiß', 'Schwarz', 'Blau-Grau', 'Rosa'];
    let colorIndex = 0;
    let styleIndex = 0;
    let styles = ['klassisch', 'modern', 'smart', 'crop', 'cropMax', 'none'];
    


	function updatePassepartoutStyle() {
      passepartout.style.display = 'flex';
      passepartout.className = 'passepartout';
      
      if (styles[styleIndex] === 'modern') {
        passepartout.classList.add('modern');
      } else if (styles[styleIndex] === 'crop') {
        passepartout.classList.add('crop');
      } else if (styles[styleIndex] === 'cropMax') {
        passepartout.classList.add('cropMax');
      } else if (styles[styleIndex] === 'none') {
        passepartout.classList.add('none');
      } else {	    
        passepartout.classList.add('contain');
      }

      document.getElementById('styleLabel').textContent = styles[styleIndex];
    }
	
	function setPassepartout(index) {
      const color = matColors[index];
      passepartout.style.background = color;
      document.body.style.background = color;
      document.getElementById('colorLabel').textContent = colorNames[index];
    }
	
	
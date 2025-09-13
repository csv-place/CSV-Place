// ⚠️ Cambia esta URL al backend en Render
const socket = io("URL_DEL_BACKEND_EN_RENDER"); // <-- Reemplazaremos esto en el siguiente paso

// Elementos del DOM
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const canvasViewport = document.getElementById("canvasViewport");
const pixelPreview = document.getElementById("pixelPreview");
const status = document.getElementById("status");
const onlineUsers = document.getElementById("onlineUsers");
const totalPixels = document.getElementById("totalPixels");
const uptime = document.getElementById("uptime");
const cooldownTimer = document.getElementById("cooldownTimer");
const coordinates = document.getElementById("coordinates");
const zoomLevel = document.getElementById("zoomLevel");

// Elementos del menú de colores
const colorMenuButton = document.getElementById("colorMenuButton");
const colorDropdown = document.getElementById("colorDropdown");
const colorPaletteGrid = document.getElementById("colorPaletteGrid");
const customColorPicker = document.getElementById("customColorPicker");
const currentColorPreview = document.getElementById("currentColorPreview");
const placePixelButton = document.getElementById("placePixelButton");

// Controles de zoom
const zoomInButton = document.getElementById("zoomIn");
const zoomOutButton = document.getElementById("zoomOut");
const resetZoomButton = document.getElementById("resetZoom");

// Configuración del canvas
const CANVAS_WIDTH = 3840;
const CANVAS_HEIGHT = 1902;
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// Variables de estado
let isCooldown = false;
let cooldownEndTime = 0;
let pixelCount = 0;
let startTime = Date.now();
let selectedColor = "#ff0000";
let selectedPixel = null;
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let isPinching = false;
let initialTouchDistance = 0;
let canvasTransform = {
  justPlacedPixel: false, // Flag para evitar el hover inmediato
  isMouseOverControls: false, // Flag para ignorar eventos del canvas
  x: 0, 
  y: 0,
  scale: 1
};

// Paleta de colores populares
const popularColors = [
  "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF",
  "#FF4500", "#008000", "#000080", "#800080", "#FFA500", "#FFC0CB",
  "#A52A2A", "#808080", "#000000", "#FFFFFF", "#FFD700", "#32CD32",
  "#FF1493", "#00CED1", "#8B4513", "#4B0082", "#DC143C", "#20B2AA"
];

// Inicializar paleta de colores
function initializeColorPalette() {
  colorPaletteGrid.innerHTML = '';
  popularColors.forEach(color => {
    const colorOption = document.createElement('div');
    colorOption.className = 'color-option';
    colorOption.style.backgroundColor = color;
    colorOption.addEventListener('click', () => {
      selectColor(color);
    });
    colorPaletteGrid.appendChild(colorOption);
  });
}

// Seleccionar color
function selectColor(color) {
  selectedColor = color;
  currentColorPreview.style.backgroundColor = color;
  customColorPicker.value = color;
  updateSelectedColorOption();
  closeColorMenu();
  
  // Actualizar preview del píxel seleccionado si existe
  if (selectedPixel) {
    updateSelectedPixelPreview();
  }
}

// Actualizar color seleccionado en la paleta
function updateSelectedColorOption() {
  document.querySelectorAll('.color-option').forEach(option => {
    option.classList.toggle('selected', option.style.backgroundColor.toUpperCase() === selectedColor.toUpperCase());
  });
}

// Abrir/cerrar menú de colores
function toggleColorMenu() {
  colorDropdown.classList.toggle('active');
}

function closeColorMenu() {
  colorDropdown.classList.remove('active');
}

// Dibujar píxel
function drawPixel(x, y, color) {
  if (color) {
    // Si hay un color, dibuja el píxel
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  } else {
    // Si el color es null (vacío), borra el área para mostrar el fondo
    ctx.clearRect(x, y, 1, 1);
  }
}

// Aplicar transformaciones del canvas
function applyCanvasTransform() {
  canvas.style.transform = `translate(-50%, -50%) translate(${canvasTransform.x}px, ${canvasTransform.y}px) scale(${canvasTransform.scale})`;
}

// Zoom
function zoomCanvas(delta, centerX, centerY) {
  const viewportRect = canvasViewport.getBoundingClientRect();
  const scaleX = viewportRect.width / canvas.width;
  const scaleY = viewportRect.height / canvas.height;
  const minScale = Math.min(scaleX, scaleY);

  const oldScale = canvasTransform.scale;
  let newScale = Math.max(minScale, Math.min(10, canvasTransform.scale + delta));
  
  if (newScale !== oldScale) {
    canvasTransform.scale = newScale;

    if (newScale <= minScale) {
      // Si alcanzamos el zoom mínimo, centramos el canvas
      canvasTransform.x = 0;
      canvasTransform.y = 0;
    } else {
      // Calcular el punto de zoom relativo al canvas centrado
      const centerXViewport = viewportRect.width / 2;
      const centerYViewport = viewportRect.height / 2;
      const x = (centerX - viewportRect.left - centerXViewport - canvasTransform.x) / oldScale;
      const y = (centerY - viewportRect.top - centerYViewport - canvasTransform.y) / oldScale;
      canvasTransform.x -= x * (newScale - oldScale);
      canvasTransform.y -= y * (newScale - oldScale);
    }

    applyCanvasTransform();
    updateZoomInfo();
    updateSelectedPixelPreview();
  }
}

// Actualizar información de zoom
function updateZoomInfo() {
  zoomLevel.textContent = `${Math.round(canvasTransform.scale * 100)}%`;
  
  // Actualizar estado de los botones de zoom
  const viewportRect = canvasViewport.getBoundingClientRect();
  const minScale = Math.min(viewportRect.width / canvas.width, viewportRect.height / canvas.height);
  const maxZoom = 10;
  
  zoomInButton.disabled = canvasTransform.scale >= maxZoom;
  zoomOutButton.disabled = canvasTransform.scale <= minScale;
}

// Resetear zoom
function resetZoom() {
  const viewportRect = canvasViewport.getBoundingClientRect();
  const scaleX = viewportRect.width / canvas.width;
  const scaleY = viewportRect.height / canvas.height;
  const minScale = Math.min(scaleX, scaleY);

  canvasTransform = { x: 0, y: 0, scale: minScale };
  applyCanvasTransform();
  updateZoomInfo();
  updateSelectedPixelPreview();
}

// Obtener coordenadas del píxel bajo el cursor
function getPixelCoordinates(mouseX, mouseY) {
  const rect = canvasViewport.getBoundingClientRect();
  const x = mouseX - rect.left;
  const y = mouseY - rect.top;
  
  // Calcular centro del viewport
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  
  // Aplicar transformación inversa considerando el centrado del canvas
  const canvasRect = canvas.getBoundingClientRect();
  const transformedX = (mouseX - canvasRect.left) / canvasTransform.scale;
  const transformedY = (mouseY - canvasRect.top) / canvasTransform.scale;
  
  // Convertir a coordenadas de píxel
  const pixelX = Math.floor(transformedX);
  const pixelY = Math.floor(transformedY);
  
  return { x: pixelX, y: pixelY };
}

// Seleccionar píxel (click)
function selectPixel(x, y) {
  if (x >= 0 && x < CANVAS_WIDTH && y >= 0 && y < CANVAS_HEIGHT) {
    selectedPixel = { x, y };
    updateSelectedPixelPreview();
    placePixelButton.style.display = 'flex';
    deselectButton.style.display = 'flex';
    coordinates.textContent = `(${x}, ${y})`;
    showStatus(`Píxel seleccionado: (${x}, ${y})`, 'success');
  }
}

// Mostrar preview del píxel seleccionado (fijo)
function updateSelectedPixelPreview() {
  if (selectedPixel) {
    // Obtener la posición y tamaño actual del canvas en la pantalla
    const canvasRect = canvas.getBoundingClientRect();
    const viewportRect = canvasViewport.getBoundingClientRect();

    // Calcular el tamaño de un píxel en la escala actual
    const scaledPixelSize = (canvasRect.width / CANVAS_WIDTH);

    // Calcular la posición del píxel seleccionado relativa al viewport
    const pixelX = (canvasRect.left - viewportRect.left) + (selectedPixel.x * scaledPixelSize);
    const pixelY = (canvasRect.top - viewportRect.top) + (selectedPixel.y * scaledPixelSize);
    
    pixelPreview.style.display = 'block';
    pixelPreview.style.left = `${pixelX}px`;
    pixelPreview.style.top = `${pixelY}px`;
    pixelPreview.style.width = `${scaledPixelSize}px`;
    pixelPreview.style.height = `${scaledPixelSize}px`;
    pixelPreview.style.backgroundColor = selectedColor;
    pixelPreview.style.border = '3px solid #ff4500';
    pixelPreview.style.boxShadow = '0 0 0 2px rgba(255, 69, 0, 0.5)';
    pixelPreview.style.opacity = '1';
  }
}

// Mostrar preview temporal al hacer hover (solo si no hay selección)
function showHoverPreview(x, y) {
  if (x >= 0 && x < CANVAS_WIDTH && y >= 0 && y < CANVAS_HEIGHT) {
    const canvasRect = canvas.getBoundingClientRect();
    const viewportRect = canvasViewport.getBoundingClientRect();
    const scaledPixelSize = (canvasRect.width / CANVAS_WIDTH);

    // Calcular la posición del píxel relativa al viewport
    const pixelX = (canvasRect.left - viewportRect.left) + (x * scaledPixelSize);
    const pixelY = (canvasRect.top - viewportRect.top) + (y * scaledPixelSize);
    
    pixelPreview.style.display = 'block';
    pixelPreview.style.left = `${pixelX}px`;
    pixelPreview.style.top = `${pixelY}px`;
    pixelPreview.style.width = `${scaledPixelSize}px`;
    pixelPreview.style.height = `${scaledPixelSize}px`;
    pixelPreview.style.backgroundColor = selectedColor;
    pixelPreview.style.border = '2px solid #ff4500';
    pixelPreview.style.boxShadow = 'none';
    pixelPreview.style.opacity = '0.7';
    
    coordinates.textContent = `(${x}, ${y})`;
  } else {
    hideHoverPreview();
  }
}

// Ocultar preview temporal
function hideHoverPreview() {
  if (!selectedPixel) {
    pixelPreview.style.display = 'none';
    coordinates.textContent = '(0, 0)';
  }
}

// Deseleccionar píxel
function deselectPixel(showCancelMessage = true) {
  selectedPixel = null;
  pixelPreview.style.display = 'none';
  placePixelButton.style.display = 'none';
  deselectButton.style.display = 'none';
  coordinates.textContent = '(0, 0)';
  if (showCancelMessage) {
    showStatus('Selección cancelada', 'info');
  }
}

// Mostrar mensaje de estado
function showStatus(message, type = 'info') {
  status.textContent = message;
  status.className = `status ${type}`;
  
  // El mensaje se resetea automáticamente después de 3 segundos
  setTimeout(() => {
    // Solo resetea si el mensaje actual no ha sido reemplazado por otro
    if (status.textContent === message) {
      status.textContent = "Haz clic en un píxel para seleccionarlo";
      status.className = "status";
    }
  }, 3000);
}

// Actualizar contador de cooldown
function updateCooldown() {
  if (isCooldown) {
    const remaining = Math.ceil((cooldownEndTime - Date.now()) / 1000);
    if (remaining > 0) {
      cooldownTimer.textContent = `${remaining}s`;
      cooldownTimer.style.color = "#ff4444";
      placePixelButton.disabled = true;
    } else {
      isCooldown = false;
      cooldownTimer.textContent = "Listo";
      cooldownTimer.style.color = "#46d160";
      placePixelButton.disabled = false;
    }
  }
}

// Actualizar tiempo de actividad
function updateUptime() {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const hours = Math.floor(elapsed / 3600).toString().padStart(2, '0');
  const minutes = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0');
  const seconds = (elapsed % 60).toString().padStart(2, '0');
  uptime.textContent = `${hours}:${minutes}:${seconds}`;
}

// Colocar píxel
function placePixel() {
  if (!selectedPixel || isCooldown) return;
  
  const { x, y } = selectedPixel;
  socket.emit("place_pixel", { x, y, color: selectedColor });
  
  // Efectos locales inmediatos
  drawPixel(x, y, selectedColor);
  
  // Iniciar cooldown local
  isCooldown = true;
  cooldownEndTime = Date.now() + 5000;
  showStatus(`Píxel colocado en (${x}, ${y})`, 'success');
  // Deseleccionar píxel después de colocarlo

  // Evitar que el hover preview aparezca inmediatamente donde está el botón
  canvasTransform.justPlacedPixel = true;
  setTimeout(() => {
    canvasTransform.justPlacedPixel = false;
    deselectPixel(false); // Deseleccionar después de un breve instante
  }, 200);
}

// Event Listeners

// Menú de colores
colorMenuButton.addEventListener('click', toggleColorMenu);
customColorPicker.addEventListener('input', (e) => {
  selectColor(e.target.value);
});

// Botón colocar píxel
placePixelButton.addEventListener('click', (e) => {
  e.stopPropagation(); // Evita que el evento se propague al canvasViewport
  placePixel();
});

// Botón cancelar selección
const deselectButton = document.getElementById('deselectButton');
deselectButton.addEventListener('click', deselectPixel);

// Controles de zoom
zoomInButton.addEventListener('click', () => {
  const rect = canvasViewport.getBoundingClientRect();
  zoomCanvas(0.3, rect.left + rect.width / 2, rect.top + rect.height / 2);
});

zoomOutButton.addEventListener('click', () => {
  const rect = canvasViewport.getBoundingClientRect();
  zoomCanvas(-0.3, rect.left + rect.width / 2, rect.top + rect.height / 2);
});

resetZoomButton.addEventListener('click', resetZoom);

canvasViewport.addEventListener('mouseleave', () => {
  if (!selectedPixel) {
    hideHoverPreview();
  }
});

canvasViewport.addEventListener('wheel', (e) => {
  e.preventDefault();
  const delta = e.deltaY > 0 ? -0.15 : 0.15;
  zoomCanvas(delta, e.clientX, e.clientY);
});

// Lógica unificada para click, drag y hover
let hasDragged = false;

canvasViewport.addEventListener('mousedown', (e) => {
  if (canvasTransform.isMouseOverControls) return;
  if (e.button === 0) { // Botón izquierdo
    isDragging = true;
    hasDragged = false;
    dragStart = { x: e.clientX - canvasTransform.x, y: e.clientY - canvasTransform.y };
    canvasViewport.style.cursor = 'grabbing';
  }
});

canvasViewport.addEventListener('mousemove', (e) => {
  if (canvasTransform.isMouseOverControls) return;
  if (isDragging) {
    // Marcar como arrastre si el mouse se mueve más de 5px
    const dx = e.clientX - (dragStart.x + canvasTransform.x);
    const dy = e.clientY - (dragStart.y + canvasTransform.y);
    if (!hasDragged && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      hasDragged = true;
    }

    // Permitir arrastrar solo si el canvas es más grande que el viewport
    const viewportRect = canvasViewport.getBoundingClientRect();
    const scaledWidth = canvas.width * canvasTransform.scale;
    const scaledHeight = canvas.height * canvasTransform.scale;

    if (scaledWidth > viewportRect.width || scaledHeight > viewportRect.height) {
      let newX = e.clientX - dragStart.x;
      let newY = e.clientY - dragStart.y;

      // Limitar el movimiento para que el canvas no se salga de la vista
      const margin = 200; // Margen de 200px
      const limitX = (scaledWidth - viewportRect.width) / 2 + margin;
      const limitY = (scaledHeight - viewportRect.height) / 2 + margin;

      // Asegurarse de que los límites no sean negativos si el canvas es más pequeño que el viewport
      const effectiveLimitX = Math.max(0, limitX);
      const effectiveLimitY = Math.max(0, limitY);

      canvasTransform.x = Math.max(-effectiveLimitX, Math.min(effectiveLimitX, newX));
      canvasTransform.y = Math.max(-effectiveLimitY, Math.min(effectiveLimitY, newY));

      applyCanvasTransform();
      updateSelectedPixelPreview();
    }
  } else {
    // Lógica de hover
    const { x, y } = getPixelCoordinates(e.clientX, e.clientY);
    if (!selectedPixel && !canvasTransform.justPlacedPixel) {
      showHoverPreview(x, y);
    }
  }
});

canvasViewport.addEventListener('mouseup', (e) => {
      if (canvasTransform.isMouseOverControls) return;
      if (isDragging) {
        // Si no se arrastró, fue un click
        if (!hasDragged) {
          const { x, y } = getPixelCoordinates(e.clientX, e.clientY);
          if (x >= 0 && x < CANVAS_WIDTH && y >= 0 && y < CANVAS_HEIGHT) {
            selectPixel(x, y);
          }
        }
        isDragging = false;
        canvasViewport.style.cursor = 'grab';
      }
    });

    // --- INICIO: Lógica para control táctil (Pinch-to-Zoom y Arrastre) ---

    function getTouchDistance(touches) {
      const [touch1, touch2] = touches;
      const dx = touch1.clientX - touch2.clientX;
      const dy = touch1.clientY - touch2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function getTouchCenter(touches) {
      const [touch1, touch2] = touches;
      return {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2,
      };
    }

    canvasViewport.addEventListener('touchstart', (e) => {
      if (canvasTransform.isMouseOverControls) return;
      // e.preventDefault() es llamado en touchmove para permitir el click en los botones
    
      const { touches } = e;
      if (touches.length === 2) {
        isPinching = true;
        isDragging = false; // No arrastrar si estamos pellizcando
        initialTouchDistance = getTouchDistance(touches);
      } else if (touches.length === 1) {
        isDragging = true;
        hasDragged = false;
        const touch = touches[0];
        dragStart = { x: touch.clientX - canvasTransform.x, y: touch.clientY - canvasTransform.y };
      }
    }, { passive: false });
    
    canvasViewport.addEventListener('touchmove', (e) => {
      if (canvasTransform.isMouseOverControls) return;
      e.preventDefault(); // Prevenir scroll de la página mientras se interactúa con el canvas
    
      const { touches } = e;
      if (isPinching && touches.length === 2) {
        const newTouchDistance = getTouchDistance(touches);
        const touchCenter = getTouchCenter(touches);
        const delta = (newTouchDistance - initialTouchDistance) * 0.02; // Sensibilidad del zoom
        
        zoomCanvas(delta, touchCenter.x, touchCenter.y);
        initialTouchDistance = newTouchDistance;
      } else if (isDragging && touches.length === 1) {
        const touch = touches[0];
        // Marcar como arrastre si el dedo se mueve más de 5px
        const dx = touch.clientX - (dragStart.x + canvasTransform.x);
        const dy = touch.clientY - (dragStart.y + canvasTransform.y);
        if (!hasDragged && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
          hasDragged = true;
        }
    
        // Lógica de arrastre (similar a mousemove)
        if(hasDragged) {
            const viewportRect = canvasViewport.getBoundingClientRect();
            const scaledWidth = canvas.width * canvasTransform.scale;
            const scaledHeight = canvas.height * canvasTransform.scale;
    
            if (scaledWidth > viewportRect.width || scaledHeight > viewportRect.height) {
              let newX = touch.clientX - dragStart.x;
              let newY = touch.clientY - dragStart.y;
    
              const margin = 200;
              const limitX = (scaledWidth - viewportRect.width) / 2 + margin;
              const limitY = (scaledHeight - viewportRect.height) / 2 + margin;
              const effectiveLimitX = Math.max(0, limitX);
              const effectiveLimitY = Math.max(0, limitY);
    
              canvasTransform.x = Math.max(-effectiveLimitX, Math.min(effectiveLimitX, newX));
              canvasTransform.y = Math.max(-effectiveLimitY, Math.min(effectiveLimitY, newY));
    
              applyCanvasTransform();
              updateSelectedPixelPreview();
            }
        }
      }
    }, { passive: false });
    
    canvasViewport.addEventListener('touchend', (e) => {
      if (canvasTransform.isMouseOverControls) return;
    
      if (isPinching && e.touches.length < 2) {
        isPinching = false;
      }
      
      if (isDragging) {
        // Si no se arrastró, fue un "tap" (click)
        if (!hasDragged && e.changedTouches.length === 1) {
          const touch = e.changedTouches[0];
          const { x, y } = getPixelCoordinates(touch.clientX, touch.clientY);
          if (x >= 0 && x < CANVAS_WIDTH && y >= 0 && y < CANVAS_HEIGHT) {
            selectPixel(x, y);
          }
        }
        isDragging = false;
      }
    });

    // --- FIN: Lógica para control táctil ---

// Prevenir menú contextual en click derecho
canvasViewport.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

// Cerrar menú de colores al hacer clic fuera
document.addEventListener('click', (e) => {
  if (!colorMenuButton.contains(e.target) && !colorDropdown.contains(e.target)) {
    closeColorMenu();
  }
});

// Detener la propagación de eventos del mouse en los controles para evitar el hover no deseado
const controlsElement = document.querySelector('.controls');
controlsElement.addEventListener('mouseenter', () => {
  canvasTransform.isMouseOverControls = true;
  hideHoverPreview();
});
controlsElement.addEventListener('mouseleave', () => {
  canvasTransform.isMouseOverControls = false;
});

// Eventos del socket
socket.on("connect", () => {
  showStatus("Conectado al servidor", 'success');
  console.log("Conectado al servidor CSV/place");
});

socket.on("disconnect", () => {
  showStatus("Desconectado del servidor", 'error');
  console.log("Desconectado del servidor");
});

socket.on("init", (data) => {
  console.log("Inicializando canvas...");
  for (let y = 0; y < CANVAS_HEIGHT; y++) {
    for (let x = 0; x < CANVAS_WIDTH; x++) {
      drawPixel(x, y, data[y][x]);
    }
  }
  showStatus("Canvas cargado correctamente", 'success');
});

socket.on("update_pixel", ({ x, y, color, userId }) => {
  drawPixel(x, y, color);
  
  // Actualizar contador solo si no es nuestro píxel
  if (userId !== socket.id) {
    pixelCount++;
    totalPixels.textContent = pixelCount;
  }
});

socket.on("error", (msg) => {
  showStatus(msg, 'error');
});

socket.on("user_count", (count) => {
  onlineUsers.textContent = `👥 ${count} ${count === 1 ? 'usuario' : 'usuarios'}`;
});

socket.on("pixel_count", (count) => {
  totalPixels.textContent = count;
  pixelCount = count;
});

socket.on("stats_update", (newStats) => {
  uptime.textContent = newStats.uptime;
  // Se elimina la llamada a showStatus para evitar conflictos
});

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  initializeColorPalette();
  selectColor("#ff0000"); // Color inicial
  
  // Aplicar transformación inicial
  resetZoom(); // <--- MODIFICADO: Ajusta el zoom inicial para que el canvas quepa en la pantalla
  
  // Actualizar contadores cada segundo
  setInterval(() => {
    updateCooldown();
    updateUptime();
  }, 1000);
  
  // Efecto de carga
  setTimeout(() => {
    showStatus("¡Bienvenido a CSV/place! Haz clic en un píxel para seleccionarlo", 'success');
  }, 1000);
});

// Manejar errores de conexión
socket.on("connect_error", (error) => {
  console.error("Error de conexión:", error);
  showStatus("Error de conexión. Verificando...", 'error');
  
  // Intentar reconectar después de 5 segundos
  setTimeout(() => {
    socket.connect();
  }, 5000);
});

// Prevenir zoom en móviles al hacer doble tap
let lastTouchEnd = 0;
document.addEventListener('touchend', function (event) {
  const now = (new Date()).getTime();
  if (now - lastTouchEnd <= 300) {
    event.preventDefault();
  }
  lastTouchEnd = now;
}, false);

// Añadir soporte para teclas de acceso rápido
document.addEventListener('keydown', (e) => {
  if (e.key >= '1' && e.key <= '9') {
    const index = parseInt(e.key) - 1;
    if (index < popularColors.length) {
      selectColor(popularColors[index]);
    }
  }
  
  // Teclas de zoom
  if (e.key === '+' || e.key === '=') {
    e.preventDefault();
    const rect = canvasViewport.getBoundingClientRect();
    zoomCanvas(0.3, rect.left + rect.width / 2, rect.top + rect.height / 2);
  } else if (e.key === '-') {
    e.preventDefault();
    const rect = canvasViewport.getBoundingClientRect();
    zoomCanvas(-0.3, rect.left + rect.width / 2, rect.top + rect.height / 2);
  } else if (e.key === '0') {
    e.preventDefault();
    resetZoom();
  }
  
  // Enter para colocar píxel
  if (e.key === 'Enter' && selectedPixel && !isCooldown) {
    placePixel();
  }
});

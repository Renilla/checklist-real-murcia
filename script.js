let dbRef = firebase.database().ref();
let currentUser = null;
let collections = [];
let collectionStates = {}; // Para almacenar el estado de las categorías

function sanitizeCollected(value) {
  if (Array.isArray(value)) {
    return value
      .filter(v => v !== undefined && v !== null)
      .map(v => Number(v))
      .filter((v, i, a) => Number.isFinite(v) && a.indexOf(v) === i)
      .sort((a, b) => a - b);
  }
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .map(k => Number(k))
      .filter((v, i, a) => Number.isFinite(v) && a.indexOf(v) === i)
      .sort((a, b) => a - b);
  }
  return [];
}

window.addEventListener('DOMContentLoaded', async () => {
  try {
    // Cargar atracciones una sola vez
    collections = await fetch('collections.json').then(r => r.json());
    
    // Cargar estados de categorías guardados
    loadCollectionStates();
    
    // Verificar si hay una sesión guardada
    const savedSession = getSavedSession();
    if (savedSession) {
      try {
        // Intentar validar la sesión guardada
        const snapshot = await dbRef.child('users/' + savedSession.username).get();
        const userData = snapshot.val();
        
        if (userData && userData.password === savedSession.password) {
          // Sesión válida, iniciar automáticamente
          currentUser = { 
            username: savedSession.username, 
            ...userData,
            collected: sanitizeCollected(userData.collected)
          };
          
          // Cargar datos de todos los usuarios ANTES de mostrar la app
          await updateRanking();
          
          showApp();
          return;
        }
      } catch (error) {
        console.error('Error validando sesión guardada:', error);
        // Limpiar sesión inválida
        clearSession();
      }
    }
    
    // Si no hay sesión válida, redirigir a login
    window.location.href = 'login.html';
  } catch (error) {
    console.error('Error en la carga inicial:', error);
    showToast('Error al cargar la aplicación. Recarga la página.', 'error');
    // En caso de error, también redirigir a login
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 2000);
  }
});

function showApp() {
  const loadingElement = document.getElementById('loading');
  const appElement = document.getElementById('app');
  
  // Smooth transition with iOS-style animation
  loadingElement.style.animation = 'fadeOut 0.3s ease-out forwards';
  
  setTimeout(() => {
    loadingElement.classList.add('hidden');
    appElement.classList.remove('hidden');
    appElement.style.animation = 'slideInUp 0.5s ease-out';
    
    // Show user profile immediately to prevent flickering
    const userProfile = document.getElementById('user-profile');
    if (userProfile) {
      // Update user name display
      const userNameDisplay = document.getElementById('user-name-display');
      if (currentUser && userNameDisplay) {
        userNameDisplay.textContent = currentUser.username;

        updatePercentaje();
      }
      // Show profile by removing visibility hidden and adding visible class
      userProfile.style.visibility = 'visible';
      userProfile.classList.add('visible');
    }
    
    // Add success animation to elements
    setTimeout(async () => {
      try {
        // Asegurar que tenemos los datos de todos los usuarios antes de renderizar
        if (!window.allUsers || Object.keys(window.allUsers).length === 0) {
          await updateRanking();
        }
        
        renderCollections();
        renderStats(window.allUsers);
        
        // Setup user profile functionality
        setupUserProfile();
        
        // Setup logout button
        document.getElementById('logout').onclick = logout;
        
        // Setup achievements button
        document.getElementById('achievements-button').onclick = goToAchievements;
        
        // Setup help button
        document.getElementById('help-button').onclick = openHelpModal;
        
        // Start listening for ranking updates
        listenForRankingUpdates();
        
        // Add success animation to cards
        document.querySelectorAll('.card').forEach((card, index) => {
          setTimeout(() => {
            card.classList.add('success-animation');
          }, index * 100);
        });
      } catch (error) {
        console.error('Error en showApp:', error);
        showToast('Error al cargar la aplicación. Recarga la página.', 'error');
      }
    }, 300);
  }, 300);
}

function updatePercentaje() {
  const totalCromos = Object.values(collections).reduce((sum, col) => sum + col.cromos.length, 0);
  const cromosUser = (currentUser.collected || []).length;
  const pct = Math.round((cromosUser / totalCromos) * 100);

  const pctDisplay = document.getElementById('pct-collection');
  pctDisplay.textContent = pct + "%";

  // Actualizar círculo
  const progressCircle = document.querySelector('.circular-progress .progress');
  if (progressCircle) {
    const radio = progressCircle.r.baseVal.value;
    const circunferencia = 2 * Math.PI * radio;
    const offset = circunferencia - (pct / 100) * circunferencia;
    progressCircle.style.strokeDashoffset = offset;
  }
}

function renderCollections() {
  const container = document.getElementById('collections-container');
  container.innerHTML = '';

  // Numeración global
  let globalIndex = 1;

  Object.entries(collections).forEach(([collectionName, data]) => {
    const collectionSection = document.createElement('div');
    collectionSection.className = 'collection-section';

    // Encabezado
    const header = document.createElement('div');
    header.className = 'collection-header';
    header.onclick = () => toggleCollection(collectionSection, collectionName);

    const title = document.createElement('div');
    title.className = 'collection-title';

    const titleText = document.createElement('span');
    titleText.textContent = data.nombre;
    title.appendChild(titleText);

    const img = document.createElement('img');
    img.src = data.portada;
    img.alt = data.nombre;
    img.className = 'collection-cover';
    title.insertBefore(img, titleText);

    const arrow = document.createElement('div');
    arrow.className = 'collection-arrow';
    arrow.innerHTML = '▼';

    header.appendChild(title);
    header.appendChild(arrow);

    // Contenido de la colección
    const content = document.createElement('div');
    content.className = 'collection-content';

    const isCollapsed = collectionStates?.[collectionName] === true;
    if (isCollapsed) {
      header.classList.add('collapsed');
      content.classList.add('collapsed');
    }

    // Contenedor único de cromos
    const cromoBlock = document.createElement('ul');
    cromoBlock.className = 'cromo-block';

    data.cromos.forEach(cromo => {
      const li = document.createElement('li');
      li.className = 'cromo-item';
      const cardIndex = globalIndex;
      const isCollected = (currentUser.collected || []).includes(cardIndex);

      // Crear label que contendrá tanto el checkbox como el texto
      const label = document.createElement('label');
      label.className = 'cromo-label';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = isCollected; // inicializar estado

      const span = document.createElement('span');
      span.textContent = `${globalIndex}. ${typeof cromo === 'string' ? cromo : (cromo.nombre ?? '')}`;
      
      // Insertamos checkbox + texto dentro del label
      label.appendChild(checkbox);
      label.appendChild(span);

      if (isCollected) {
        li.classList.add('checked');
      }
      else {
        li.classList.remove('checked');
      }

      label.onclick = (e) => { e.preventDefault(); toggleCromo(cardIndex); };

      li.appendChild(label);
      cromoBlock.appendChild(li);
      globalIndex++;
    });

    content.appendChild(cromoBlock);
    collectionSection.appendChild(header);
    collectionSection.appendChild(content);
    container.appendChild(collectionSection);
  });
}


function toggleCollection(collectionSection, collectionName) {
  const header = collectionSection.querySelector('.collection-header');
  const content = collectionSection.querySelector('.collection-content');
  const isCollapsed = header.classList.contains('collapsed');

  header.classList.toggle('collapsed');
  content.classList.toggle('collapsed');
  
  // Guardar el nuevo estado
  collectionStates[collectionName] = !isCollapsed;
  saveCollectionStates();
}

async function toggleCromo(index) {
  const collected = currentUser.collected || [];
  const idx = collected.indexOf(index);

  try {
    const marking = idx < 0;
    if (idx >= 0) {
      // Desmarcar: eliminar de collected y resetear conteo
      collected.splice(idx, 1);
    } else {
      // Marcar: añadir a collected y establecer conteo inicial a 1
      collected.push(index);
    }
    
    const sanitized = sanitizeCollected(collected);
    
    // Actualizar ambos campos en la base de datos
    await dbRef.child('users/' + currentUser.username).update({
      collected: sanitized
    });
    
    // Actualizar el usuario local
    currentUser.collected = sanitized;
    
    setTimeout(() => {
      renderCollections();
      renderStats();
      updateRanking();
    }, 200);

    // Notificación de éxito
    showToast(marking ? 'Cromo marcado' : 'Cromo desmarcado', 'success');
    
  } catch (error) {
    console.error('Error al actualizar cromo:', error);
    showToast('Error al guardar el cromo. Inténtalo de nuevo.', 'error');
  }
}

function calculateCrowns(user) {
  if (!user.collected) return 0;
  
  let crowns = 0;
  let globalIndex = 1;

  collections.forEach(col => {
    const total = col.cromos.length;

    // Los índices globales de esta colección
    const colIndices = Array.from(
      { length: total },
      (_, i) => globalIndex + i
    );

    // ¿El usuario tiene todos esos índices?
    const completed = colIndices.every(idx => user.collected.includes(idx));

    if (completed) crowns++;

    // Avanzar el globalIndex para la siguiente colección
    globalIndex += total;
  });

  return crowns;
}

function renderStats(users = null) {
  const collectedCount = (currentUser.collected || []).length;
  const totalCromos = Object.values(collections).reduce((sum, col) => sum + col.cromos.length, 0);
  document.getElementById('collected-count').textContent = collectedCount;
  document.getElementById('total-cromos').textContent = totalCromos;
  const cromosPct = (collectedCount / totalCromos) * 100;

  const crowns = calculateCrowns(currentUser);
  document.getElementById('crowns-count').textContent = crowns;

  const progressFill = document.getElementById('progress-fill');
  progressFill.style.width = cromosPct + '%';
  
  // Add complete class if progress is 100%
  if (cromosPct === 100) {
    progressFill.classList.add('complete');
  } else {
    progressFill.classList.remove('complete');
  }
  
  // Render collection stats
  renderCollectionStats();

  updatePercentaje();
}

async function updateRanking() {
  try {
    const snapshot = await dbRef.child('users').get();
    const allUsers = snapshot.val() || {};
    
    // Hacer disponible globalmente para el renderizado
    window.allUsers = allUsers;
    
    if (currentUser && allUsers[currentUser.username]) {
      currentUser.collected = sanitizeCollected(allUsers[currentUser.username].collected);
    }
    
    renderStats(allUsers);
    
    // Re-renderizar atracciones para actualizar emoticonos si la app está visible
    if (!document.getElementById('app').classList.contains('hidden')) {
      renderCollections();
    }
  } catch (error) {
    console.error('Error updating ranking:', error);
  }
}

function listenForRankingUpdates() {
  dbRef.child('users').on('value', snapshot => {
    const allUsers = snapshot.val() || {};
    
    // Hacer disponible globalmente para el renderizado
    window.allUsers = allUsers;
    
    if (currentUser && allUsers[currentUser.username]) {
      currentUser.collected = sanitizeCollected(allUsers[currentUser.username].collected);
      renderStats(allUsers);
    }
  });
}

function renderCollectionStats() {
  const statsContainer = document.getElementById('collection-stats');
  if (!statsContainer) return;
  
  // Limpiar el contenedor
  statsContainer.innerHTML = '';

  let globalIndex = 1;

  // Recorrer las colecciones
  Object.entries(collections).forEach(([key, col]) => {
    const total = col.cromos.length;

    // Contar cuántos cromos de esta colección están en collected
    const completed = col.cromos.filter(() => {
      const id = globalIndex++;
      return currentUser.collected && currentUser.collected.includes(id);
    }).length;

    // Crear el elemento de la estadística
    const stat = document.createElement('div');
    stat.className = 'collection-stat';

    const colorDot = document.createElement('div');
    colorDot.className = 'collection-stat-color';

    const label = document.createElement('div');
    label.className = 'collection-stat-name';
    label.textContent = `${col.nombre}:`;

    const count = document.createElement('div');
    count.className = 'collection-stat-count';
    count.textContent = `${completed}/${total}`;

    stat.appendChild(colorDot);
    stat.appendChild(label);
    stat.appendChild(count);

    statsContainer.appendChild(stat);
  });
}

function loadCollectionStates() {
  try {
    const savedStates = localStorage.getItem('checklist_murcia_collection_states');
    if (savedStates) {
      collectionStates = JSON.parse(savedStates);
    }
  } catch (error) {
    console.error('Error loading collection states:', error);
    collectionStates = {};
  }
}

function saveCollectionStates() {
  try {
    localStorage.setItem('checklist_murcia_collection_states', JSON.stringify(collectionStates));
  } catch (error) {
    console.error('Error saving collection states:', error);
  }
}

// Funciones para manejar cookies de sesión
function setCookie(name, value, days = 30) {
  const expires = new Date();
  expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
  document.cookie = `${name}=${encodeURIComponent(JSON.stringify(value))};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

function getCookie(name) {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) {
      try {
        return JSON.parse(decodeURIComponent(c.substring(nameEQ.length, c.length)));
      } catch (error) {
        console.error('Error parsing cookie:', error);
        return null;
      }
    }
  }
  return null;
}

function deleteCookie(name) {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
}

function saveSession(username, password) {
  setCookie('checklist_murcia_session', { username, password });
}

function getSavedSession() {
  return getCookie('checklist_murcia_session');
}

function clearSession() {
  deleteCookie('checklist_murcia_session');
}

function logout() {
  // Disconnect Firebase listener
  dbRef.child('users').off('value');
  
  closeProfileModal();

  // Clear current user
  currentUser = null;
  
  // Clear session
  clearSession();
  
  // Redirect to login page
  window.location.href = 'login.html';
}

// User Profile Functions
function setupUserProfile() {
  const userProfile = document.getElementById('user-profile');
  const profileModal = document.getElementById('profile-modal');
  const closeModal = document.getElementById('close-modal');
  const profileForm = document.getElementById('profile-form');
  const deleteAccountBtn = document.getElementById('delete-account');
  
  // User profile is already visible and name is already set in showApp()
  // Just setup the event listeners
  
  // Open modal on user profile click
  userProfile.addEventListener('click', () => {
    openProfileModal();
  });
  
  // Close modal
  closeModal.addEventListener('click', () => {
    closeProfileModal();
  });
  
  // Close modal on overlay click
  profileModal.querySelector('.modal-overlay').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      closeProfileModal();
    }
  });
  
  // Handle form submission
  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await updateUserProfile();
  });
  
  // Handle account deletion
  deleteAccountBtn.addEventListener('click', () => {
    openDeleteConfirmModal();
  });
}

function updateUserNameDisplay() {
  const userNameDisplay = document.getElementById('user-name-display');
  if (currentUser && userNameDisplay) {
    userNameDisplay.textContent = currentUser.username;
  }
}

function openProfileModal() {
  const modal = document.getElementById('profile-modal');
  const usernameInput = document.getElementById('profile-username');
  const passwordInput = document.getElementById('profile-password');
  const confirmPasswordInput = document.getElementById('profile-confirm-password');
  
  // Fill current values
  usernameInput.value = currentUser.username;
  passwordInput.value = '';
  confirmPasswordInput.value = '';
  
  // Show modal
  modal.classList.remove('hidden');
}

function closeProfileModal() {
  const modal = document.getElementById('profile-modal');
  modal.classList.add('hidden');
}

async function updateUserProfile() {
  const usernameInput = document.getElementById('profile-username');
  const passwordInput = document.getElementById('profile-password');
  const confirmPasswordInput = document.getElementById('profile-confirm-password');
  
  const newUsername = usernameInput.value.trim();
  const newPassword = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;
  
  // Validation
  if (!newUsername) {
    showToast('El nombre de usuario no puede estar vacío', 'error');
    return;
  }
  
  if (newPassword && newPassword !== confirmPassword) {
    showToast('Las contraseñas no coinciden', 'error');
    return;
  }
  
  if (newPassword && newPassword.length < 6) {
    showToast('La contraseña debe tener al menos 6 caracteres', 'error');
    return;
  }
  
  try {
    // Check if new username already exists (if username is changing)
    if (newUsername !== currentUser.username) {
      const snapshot = await dbRef.child('users/' + newUsername).get();
          if (snapshot.exists()) {
      showToast('El nombre de usuario ya existe', 'error');
      return;
    }
    }
    
    // If username is changing, we need to move the data
    if (newUsername !== currentUser.username) {
      // Copy ALL current user data to new username
      const currentUserData = {
        password: newPassword || currentUser.password,
        collected: currentUser.collected || [],
        // Preserve any other user data that might exist
        ...Object.fromEntries(
          Object.entries(currentUser).filter(([key]) => 
            !['username', 'password', 'collected'].includes(key)
          )
        )
      };
      
      // Set new user data
      await dbRef.child('users/' + newUsername).set(currentUserData);
      
      // Remove old user data
      await dbRef.child('users/' + currentUser.username).remove();
      
      // Update current user
      currentUser.username = newUsername;
      currentUser.password = currentUserData.password;
      // Update other fields in currentUser to match the saved data
      Object.assign(currentUser, currentUserData);
    } else if (newPassword) {
      // Only update password
      await dbRef.child('users/' + currentUser.username + '/password').set(newPassword);
      currentUser.password = newPassword;
    }
    
    // Update display
    updateUserNameDisplay();
    
    // Close modal
    closeProfileModal();
    
    // Show success message
    showToast('Perfil actualizado correctamente', 'success');
    
  } catch (error) {
    console.error('Error updating profile:', error);
    showToast('Error al actualizar el perfil. Inténtalo de nuevo.', 'error');
  }
}

function openDeleteConfirmModal() {
  const deleteConfirmModal = document.getElementById('delete-confirm-modal');
  const closeDeleteModal = document.getElementById('close-delete-modal');
  const cancelDeleteBtn = document.getElementById('cancel-delete');
  const confirmDeleteBtn = document.getElementById('confirm-delete');
  
  // Close profile modal
  closeProfileModal();
  
  // Show delete confirmation modal
  deleteConfirmModal.classList.remove('hidden');
  
  // Close modal handlers
  closeDeleteModal.addEventListener('click', closeDeleteConfirmModal);
  cancelDeleteBtn.addEventListener('click', closeDeleteConfirmModal);
  
  // Confirm deletion
  confirmDeleteBtn.addEventListener('click', async () => {
    await deleteUserAccount();
  });
  
  // Close on overlay click
  deleteConfirmModal.querySelector('.modal-overlay').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      closeDeleteConfirmModal();
    }
  });
}

function closeDeleteConfirmModal() {
  const deleteConfirmModal = document.getElementById('delete-confirm-modal');
  deleteConfirmModal.classList.add('hidden');
}

async function deleteUserAccount() {
  try {
    // Remove user data from database
    await dbRef.child('users/' + currentUser.username).remove();
    
    // Close modal
    closeDeleteConfirmModal();
    
    // Show success notification
    showSuccessNotification('Cuenta eliminada correctamente');
    
    // Logout user after a short delay
    setTimeout(() => {
      logout();
    }, 1500);
    
  } catch (error) {
    console.error('Error deleting account:', error);
    showSuccessNotification('Error al eliminar la cuenta. Inténtalo de nuevo.');
  }
}

// Toast Notification System
function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  // Get icon based on type
  const icon = getToastIcon(type);
  
  toast.innerHTML = `
    <div class="toast-icon">
      ${icon}
    </div>
    <div class="toast-message">${message}</div>
    <button class="toast-close" onclick="this.parentElement.remove()">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z" fill="currentColor"/>
      </svg>
    </button>
  `;
  
  // Add to container
  container.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  // Auto remove after duration
  setTimeout(() => {
    if (toast.parentElement) {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentElement) {
          toast.remove();
        }
      }, 400);
    }
  }, duration);
}

function getToastIcon(type) {
  switch (type) {
    case 'success':
      return `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z" fill="currentColor"/>
      </svg>`;
    case 'error':
      return `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" fill="currentColor"/>
      </svg>`;
    case 'warning':
      return `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 21H23L12 2L1 21ZM13 18H11V16H13V18ZM13 14H11V12H13V14Z" fill="currentColor"/>
      </svg>`;
    case 'info':
    default:
      return `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" fill="currentColor"/>
      </svg>`;
  }
}

function showSuccessNotification(message) {
  showToast(message, 'success');
}

function goToAchievements() {
  window.location.href = 'logros.html';
}

// Help Modal Functions
function openHelpModal() {
  const modal = document.getElementById('help-modal');
  modal.classList.remove('hidden');
  
  // Setup close button
  document.getElementById('close-help-modal').onclick = closeHelpModal;
  
  // Close on overlay click
  modal.querySelector('.modal-overlay').onclick = closeHelpModal;
}

function closeHelpModal() {
  const modal = document.getElementById('help-modal');
  modal.classList.add('hidden');
}
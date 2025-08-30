let dbRef = firebase.database().ref();
let currentUser = null;
let attractions = [];

// Mapeo de atracciones a nombres de logros
const achievementMapping = {
  "Furius Baco": "Mono Loco",
  "Serpiente Emplumada": "Quetzalcóatl",
  "Dragon Khan": "Domador de dragones",
  "Stampida": "Colono pionero",
  "Templo del Fuego": "Homo Erectus",
  "Estació del Nord": "Ruta de la seda",
  "Wild Buffalos": "Cowboy experto",
  "Shambhala": "Escalador del Himalaya",
  "Hurakan Condor": "Chamán",
  "Carousel": "Americano",
  "Kon-tiki Wave": "Capitán Cook",
  "Tutuki Splash": "Maestro de lava",
  "Junior Red Force": "Caballino Cagado",
  "Tami Tami": "Tiki",
  "Street Mission": "Detective jefe",
  "Angkor": "Francotirador",
  "Racing Legends": "Carrerista",
  "Maranello Grand Race": "Piloto",
  "Coco Piloto": "Pecador de cocos",
  "Grand Canyon Rapids": "Colorao",
  "Silver River Flume": "El Tronco",
  "El Diablo – Tren de la Mina": "El Diavlo",
  "Tea Cups": "Hora del Té",
  "Potrillos": "Jinete",
  "Tomahawk": "Jefe de la tribu",
  "Crazy Barrels": "Minero",
  "Thrill Towers": "Pistón Loco",
  "Red Force": "Caballino Dopado",
  "Granja de Elmo": "Granjero",
  "Uncharted": "Nathan Drake",
  "El Secreto de los Mayas": "Guía",
  "Laberinto Blacksmith": "Investigador",
  "Port de la Drassana": "Magallanes",
  "Magic Fish": "Pescador",
  "Kiddie Dragons": "Dragoncito",
  "Volpaiute": "Nativo americano",
  "Buffalo Rodeo": "Cowboy principiante",
  "Cobra Imperial": "Domador del Emperador",
  "Yucatán": "Mariachi"
};

window.addEventListener('DOMContentLoaded', async () => {
  try {
    // Cargar atracciones
    attractions = await fetch('attractions.json').then(r => r.json());
    
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
            ridden: userData.ridden || [],
            rideCounts: userData.rideCounts || {}
          };
          
          showAchievementsApp();
          return;
        }
      } catch (error) {
        console.error('Error validando sesión guardada:', error);
        // Limpiar sesión inválida
        clearSession();
      }
    }
    
    // Si no hay sesión válida, redirigir a login.html
    window.location.href = 'login.html';
  } catch (error) {
    console.error('Error en la carga inicial:', error);
    // En caso de error, también redirigir a login.html
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 2000);
  }
});

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
  setCookie('portaventura_session', { username, password });
}

function getSavedSession() {
  return getCookie('portaventura_session');
}

function clearSession() {
  deleteCookie('portaventura_session');
}



function showAchievementsApp() {
  const appElement = document.getElementById('achievements-app');
  
  // Reset any existing animations
  appElement.style.animation = '';
  
  // Show the app directly since there's no auth element
  appElement.classList.remove('hidden');
  appElement.style.animation = 'slideInUp 0.5s ease-out';
  
  // Setup achievements functionality
  setupAchievements();
  setupUserProfile();
  setupNavigation();
}

function setupAchievements() {
  renderAchievements();
  renderAchievementStats();
}

function renderAchievements() {
  const achievementsList = document.getElementById('achievements-list');
  if (!achievementsList) return;
  
  achievementsList.innerHTML = '';
  
  // Filtrar atracciones que tienen logros definidos
  const achievementsWithMapping = attractions.filter((attraction, index) => {
    return achievementMapping[attraction.name] !== undefined;
  });
  
  // Crear array de logros con información de estado
  const achievementsData = achievementsWithMapping.map((attraction, index) => {
    const originalIndex = attractions.findIndex(a => a.name === attraction.name);
    const rideCount = currentUser.rideCounts[originalIndex] || 0;
    const achievementName = achievementMapping[attraction.name];
    
    // Determinar el estado del logro y prioridad para ordenamiento
    let medalClass = 'locked';
    let medalIcon = '🔒';
    let medalText = 'Bloqueado';
    let priority = 0; // 0 = bloqueado, 1 = bronce, 2 = plata, 3 = oro
    
    if (rideCount >= 4) {
      medalClass = 'diamond';
      medalIcon = '💎​';
      medalText = 'Diamante';
      priority = 4;
    } else if (rideCount >= 3) {
      medalClass = 'gold';
      medalIcon = '🥇';
      medalText = 'Oro';
      priority = 3;
    } else if (rideCount >= 2) {
      medalClass = 'silver';
      medalIcon = '🥈';
      medalText = 'Plata';
      priority = 2;
    } else if (rideCount >= 1) {
      medalClass = 'bronze';
      medalIcon = '🥉';
      medalText = 'Bronce';
      priority = 1;
    }
    
    return {
      attraction,
      rideCount,
      achievementName,
      medalClass,
      medalIcon,
      medalText,
      priority
    };
  });
  
  // Ordenar logros: primero los desbloqueados (por prioridad descendente), luego los bloqueados
  achievementsData.sort((a, b) => {
    // Si ambos están bloqueados o ambos desbloqueados, mantener orden original
    if ((a.priority === 0 && b.priority === 0) || (a.priority > 0 && b.priority > 0)) {
      return 0;
    }
    // Si uno está bloqueado y otro no, el desbloqueado va primero
    if (a.priority === 0 && b.priority > 0) return 1;
    if (a.priority > 0 && b.priority === 0) return -1;
    // Si ambos están desbloqueados, ordenar por prioridad (oro > plata > bronce)
    return b.priority - a.priority;
  });
  
  // Renderizar logros ordenados
  achievementsData.forEach(achievement => {
    const achievementElement = document.createElement('div');
    achievementElement.className = 'achievement-item';
    
    achievementElement.innerHTML = `
      <div class="achievement-medal ${achievement.medalClass}">
        <span class="medal-icon">${achievement.medalIcon}</span>
        <span class="medal-text">${achievement.medalText}</span>
      </div>
      <div class="achievement-info">
        <h4 class="achievement-name">${achievement.achievementName}</h4>
        <p class="achievement-attraction">${achievement.attraction.name}</p>
        <p class="achievement-progress">Montado ${achievement.rideCount} veces</p>
      </div>
    `;
    
    achievementsList.appendChild(achievementElement);
  });
}

function renderAchievementStats() {
  const statsContainer = document.getElementById('achievements-stats');
  if (!statsContainer) return;
  
  const achievementsWithMapping = attractions.filter(attraction => {
    return achievementMapping[attraction.name] !== undefined;
  });
  
  let totalAchievements = achievementsWithMapping.length;
  let unlockedAchievements = 0;
  let bronzeMedals = 0;
  let silverMedals = 0;
  let goldMedals = 0;
  
  achievementsWithMapping.forEach(attraction => {
    const originalIndex = attractions.findIndex(a => a.name === attraction.name);
    const rideCount = currentUser.rideCounts[originalIndex] || 0;
    
    if (rideCount >= 1) {
      unlockedAchievements++;
      if (rideCount >= 3) {
        goldMedals++;
      } else if (rideCount >= 2) {
        silverMedals++;
      } else {
        bronzeMedals++;
      }
    }
  });
  
  const completionPercentage = totalAchievements > 0 ? Math.round((unlockedAchievements / totalAchievements) * 100) : 0;
  
  statsContainer.innerHTML = `
    <div class="achievement-stat">
      <div class="stat-icon">🏆</div>
      <div class="stat-info">
        <div class="stat-value">${unlockedAchievements}/${totalAchievements}</div>
        <div class="stat-label">Logros desbloqueados</div>
      </div>
    </div>
    <div class="achievement-stat">
      <div class="stat-icon">📊</div>
      <div class="stat-info">
        <div class="stat-value">${completionPercentage}%</div>
        <div class="stat-label">Progreso total</div>
      </div>
    </div>
    <div class="achievement-stat">
      <div class="stat-icon">🥇</div>
      <div class="stat-info">
        <div class="stat-value">${goldMedals}</div>
        <div class="stat-label">Medallas de oro</div>
      </div>
    </div>
    <div class="achievement-stat">
      <div class="stat-icon">🥈</div>
      <div class="stat-info">
        <div class="stat-value">${silverMedals}</div>
        <div class="stat-label">Medallas de plata</div>
      </div>
    </div>
    <div class="achievement-stat">
      <div class="stat-icon">🥉</div>
      <div class="stat-info">
        <div class="stat-value">${bronzeMedals}</div>
        <div class="stat-label">Medallas de bronce</div>
      </div>
    </div>
  `;
}

function setupUserProfile() {
  const userProfile = document.getElementById('user-profile-achievements');
  const userNameDisplay = document.getElementById('user-name-display-achievements');
  const profileModal = document.getElementById('profile-modal');
  const closeModal = document.getElementById('close-modal');
  const profileForm = document.getElementById('profile-form');
  const deleteAccountBtn = document.getElementById('delete-account');
  
  if (userProfile && userNameDisplay) {
    userNameDisplay.textContent = currentUser.username;
    userProfile.classList.add('visible');
  }
  
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

function setupNavigation() {
  // Back button
  const backButton = document.getElementById('back-button');
  if (backButton) {
    backButton.addEventListener('click', () => {
      window.location.href = 'index.html';
    });
  }
  
  // Logout button
  const logoutButton = document.getElementById('logout-achievements');
  if (logoutButton) {
    logoutButton.addEventListener('click', logout);
  }
}

function logout() {
  // Disconnect Firebase listener
  dbRef.child('users').off('value');
  
  // Clear current user
  currentUser = null;
  
  // Clear session
  clearSession();
  
  // Redirect to login page
  window.location.href = 'login.html';
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

// User Profile Functions
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
    
    // Prepare update data
    const updateData = {};
    
    // If username is changing, we need to move the data
    if (newUsername !== currentUser.username) {
      // Copy current user data to new username
      const currentUserData = {
        password: newPassword || currentUser.password,
        ridden: currentUser.ridden || [],
        rideCounts: currentUser.rideCounts || {}
      };
      
      // Set new user data
      await dbRef.child('users/' + newUsername).set(currentUserData);
      
      // Remove old user data
      await dbRef.child('users/' + currentUser.username).remove();
      
      // Update current user
      currentUser.username = newUsername;
      currentUser.password = currentUserData.password;
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
    showToast('Error al eliminar la cuenta. Inténtalo de nuevo.', 'error');
  }
}

function showSuccessNotification(message) {
  const successModal = document.getElementById('success-notification-modal');
  const notificationText = document.getElementById('notification-text');
  const closeNotification = document.getElementById('close-notification');
  
  notificationText.textContent = message;
  successModal.classList.remove('hidden');
  
  // Close notification
  closeNotification.addEventListener('click', () => {
    successModal.classList.add('hidden');
  });
  
  // Close on overlay click
  successModal.querySelector('.modal-overlay').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      successModal.classList.add('hidden');
    }
  });
}

function updateUserNameDisplay() {
  const userNameDisplay = document.getElementById('user-name-display-achievements');
  if (currentUser && userNameDisplay) {
    userNameDisplay.textContent = currentUser.username;
  }
} 
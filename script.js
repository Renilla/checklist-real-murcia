let dbRef = firebase.database().ref();
let currentUser = null;
let collections = [];
let collectionsStates = {}; // Para almacenar el estado de las categorías

window.addEventListener('DOMContentLoaded', async () => {
  try {
    // Cargar atracciones una sola vez
    collections = await fetch('collections.json').then(r => r.json());
    
    // Cargar estados de categorías guardados
    loadCategoryStates();
    
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
            collected: userData.collected || {}
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
        //renderStats(window.allUsers);
        
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

function renderCollections() {
  const container = document.getElementById('collections-container');
  container.innerHTML = '';
  
  // Create category sections
  Object.entries(collections).forEach(([collectionName, data], collectionIndex) => {
    const collectionSection = document.createElement('div');
    collectionSection.className = 'collection-section';
    
    // Collection header
    const header = document.createElement('div');
    header.className = 'collection-header';
    header.onclick = () => toggleCategory(collectionSection, collectionName);
    
    const title = document.createElement('div');
    title.className = 'collection-title';
    
    const titleText = document.createElement('span');
    titleText.textContent = collectionName.name;
    
    title.appendChild(titleText);
    
    const arrow = document.createElement('div');
    arrow.className = 'collection-arrow';
    arrow.innerHTML = '▼';
    
    header.appendChild(title);
    header.appendChild(arrow);
    
    // Category content
    const content = document.createElement('div');
    content.className = 'collection-content';
    
    // Aplicar estado guardado
    const isCollapsed = collectionsStates[collectionName] === true;
    if (isCollapsed) {
      header.classList.add('collapsed');
      content.classList.add('collapsed');
    }
    
    const cromoList = document.createElement('ul');
    cromoList.className = 'collection-cromos';
    
    data.cromos.forEach((cromo, cromoIndex) => {
      const li = document.createElement('li');
      
      const name = document.createElement('span');
      name.className = 'cromo-name';
      name.textContent = cromo;
      
      const hasCromo = currentUser.collected?.[collectionName]?.includes(cromo);

      const button = document.createElement('button');
      button.textContent = hasCromo ? 'Quitar' : 'Añadir';
      button.onclick = () => toggleCromo(collectionName, cromo);
      
      li.appendChild(name);
      li.appendChild(button);
      cromoList.appendChild(li);

      // Animación de entrada
      li.style.opacity = '0';
      li.style.transform = 'translateY(20px)';
      setTimeout(() => {
        li.style.transition = 'all 0.3s ease-out';
        li.style.opacity = '1';
        li.style.transform = 'translateY(0)';
      }, (index * 100) + (cromoIndex * 50));
    });

    content.appendChild(cromoList);
    collectionSection.appendChild(header);
    collectionSection.appendChild(content);
    container.appendChild(collectionSection);
  });

  // Mostrar total de cromos
  const totalCromos = Object.values(collections).reduce((sum, col) => sum + col.cromos.length, 0);
  document.getElementById('total-cromos').textContent = totalCromos;
}

function toggleCategory(categorySection, categoryName) {
  const header = categorySection.querySelector('.collection-header');
  const content = categorySection.querySelector('.collection-content');
  const isCollapsed = header.classList.contains('collapsed');

  header.classList.toggle('collapsed');
  content.classList.toggle('collapsed');
  
  // Guardar el nuevo estado
  categoryStates[categoryName] = !isCollapsed;
  saveCategoryStates();
}

async function toggleRide(index) {
  const ridden = currentUser.ridden || [];
  const rideCounts = currentUser.rideCounts || {};
  const idx = ridden.indexOf(index);
  
  // Add loading state
  const button = event.target;
  if (button) {
    button.classList.add('loading');
    button.textContent = '...';
  }
  
  try {
    if (idx >= 0) {
      // Desmarcar: eliminar de ridden y resetear conteo
      ridden.splice(idx, 1);
      delete rideCounts[index];
    } else {
      // Marcar: añadir a ridden y establecer conteo inicial a 1
      ridden.push(index);
      rideCounts[index] = 1;
    }
    
    // Actualizar ambos campos en la base de datos
    await dbRef.child('users/' + currentUser.username).update({
      ridden: ridden,
      rideCounts: rideCounts
    });
    
    // Actualizar el usuario local
    currentUser.ridden = ridden;
    currentUser.rideCounts = rideCounts;
    
    // Success animation
    button.classList.remove('loading');
    button.classList.add('success-animation');
    
    setTimeout(() => {
      renderAttractions();
      renderStats();
      updateRanking(); // Update ranking immediately after ride toggle
    }, 200);
    
  } catch (error) {
    button.classList.remove('loading');
    showToast('Error al actualizar. Inténtalo de nuevo.', 'error');
  }
}

async function incrementRide(index) {
  const rideCounts = currentUser.rideCounts || {};
  const currentCount = rideCounts[index] || 0;
  
  try {
    rideCounts[index] = currentCount + 1;
    
    await dbRef.child('users/' + currentUser.username + '/rideCounts/' + index).set(rideCounts[index]);
    currentUser.rideCounts = rideCounts;
    
    renderAttractions();
    renderStats();
    updateRanking();
    
    showToast('¡Añadida una vez más!', 'success');
  } catch (error) {
    showToast('Error al actualizar. Inténtalo de nuevo.', 'error');
  }
}

async function decrementRide(index) {
  const rideCounts = currentUser.rideCounts || {};
  const currentCount = rideCounts[index] || 0;
  
  if (currentCount <= 1) {
    // Si solo queda 1, desmarcar completamente
    await toggleRide(index);
    return;
  }
  
  try {
    rideCounts[index] = currentCount - 1;
    
    await dbRef.child('users/' + currentUser.username + '/rideCounts/' + index).set(rideCounts[index]);
    currentUser.rideCounts = rideCounts;
    
    renderAttractions();
    renderStats();
    updateRanking();
    
    showToast('Eliminada una vez', 'info');
  } catch (error) {
    showToast('Error al actualizar. Inténtalo de nuevo.', 'error');
  }
}

function calculateCrownsAndHandshakes(user, allUsers = null) {
  let crowns = 0;
  
  return crowns;
}

function renderStats(users = null) {
  const progressFill = document.getElementById('progress-fill');
  progressFill.style.width = attractionPct + '%';
  
  // Add complete class if progress is 100%
  if (attractionPct >= 100) {
    progressFill.classList.add('complete');
  } else {
    progressFill.classList.remove('complete');
  }
  
  // Render category stats
  renderCategoryStats();
}

async function updateRanking() {
  try {
    const snapshot = await dbRef.child('users').get();
    const allUsers = snapshot.val() || {};
    
    // Hacer disponible globalmente para el renderizado
    window.allUsers = allUsers;
    
    if (currentUser && allUsers[currentUser.username]) {
      currentUser.ridden = allUsers[currentUser.username].ridden || [];
      currentUser.rideCounts = allUsers[currentUser.username].rideCounts || {};
    }
    
    renderStats(allUsers);
    
    // Re-renderizar atracciones para actualizar emoticonos si la app está visible
    if (!document.getElementById('app').classList.contains('hidden')) {
      renderAttractions();
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
      currentUser.ridden = allUsers[currentUser.username].ridden || [];
      currentUser.rideCounts = allUsers[currentUser.username].rideCounts || {};
      renderStats(allUsers);
    }
  });
}

function renderCategoryStats() {
  const categoryStatsContainer = document.getElementById('category-stats');
  if (!categoryStatsContainer) return;
  
  // Group attractions by category
  const categories = {};
  attractions.forEach((attr, index) => {
    if (!categories[attr.category]) {
      categories[attr.category] = {
        name: attr.category,
        color: attr.color,
        total: 0,
        completed: 0
      };
    }
    categories[attr.category].total++;
    
    // Check if this attraction is completed
    if (currentUser.ridden && currentUser.ridden.includes(index)) {
      categories[attr.category].completed++;
    }
  });
  
  // Clear container
  categoryStatsContainer.innerHTML = '';
  
  // Create category stat elements
  Object.values(categories).forEach(category => {
    const categoryStat = document.createElement('div');
    categoryStat.className = 'category-stat';
    
    const colorDot = document.createElement('div');
    colorDot.className = `category-stat-color ${category.color}`;
    
    const categoryCount = document.createElement('div');
    categoryCount.className = 'category-stat-count';
    categoryCount.textContent = `${category.completed}/${category.total}`;
    
    categoryStat.appendChild(colorDot);
    categoryStat.appendChild(categoryCount);
    
    categoryStatsContainer.appendChild(categoryStat);
  });
}




function loadCategoryStates() {
  try {
    const savedStates = localStorage.getItem('checklist_murcia_collection_states');
    if (savedStates) {
      categoryStates = JSON.parse(savedStates);
    }
  } catch (error) {
    console.error('Error loading collection states:', error);
    categoryStates = {};
  }
}

function saveCategoryStates() {
  try {
    localStorage.setItem('checklist_murcia_collection_states', JSON.stringify(categoryStates));
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
        ridden: currentUser.ridden || [],
        rideCounts: currentUser.rideCounts || {},
        // Preserve any other user data that might exist
        ...Object.fromEntries(
          Object.entries(currentUser).filter(([key]) => 
            !['username', 'password', 'ridden', 'rideCounts'].includes(key)
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
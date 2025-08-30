let dbRef = firebase.database().ref();
let currentUser = null;
let attractions = [];
let allUsers = {};
let attractionsChart = null;
let playerAttractionsChart = null;

// Verificación de sesión al cargar la página
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
          // Sesión válida, cargar datos
          currentUser = { 
            username: savedSession.username, 
            ...userData, 
            ridden: userData.ridden || [],
            rideCounts: userData.rideCounts || {}
          };
          
          // Cargar datos de todos los usuarios
          await loadAllUsers();
          
          // Mostrar rankings
          showRankings();
          return;
        }
      } catch (error) {
        console.error('Error validando sesión guardada:', error);
        clearSession();
      }
    }
    
    // Si no hay sesión válida, redirigir a login
    window.location.href = 'login.html';
  } catch (error) {
    console.error('Error en la carga inicial:', error);
    showToast('Error al cargar la aplicación. Recarga la página.', 'error');
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

// Toast Notification System
function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
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
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
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

// Funciones de cálculo de puntos
function calculatePoints(riddenIndices, rideCounts = {}) {
  return riddenIndices.reduce((total, index) => {
    const basePoints = attractions[index]?.points || 0;
    const rideCount = rideCounts[index] || 0;
    
    // Solo dar puntos si se ha montado al menos una vez
    if (rideCount > 0) {
      return total + basePoints;
    }
    
    return total;
  }, 0);
}

function calculatePointsWithBonuses(riddenIndices, rideCounts = {}, allUsers = null) {
  let totalPoints = 0;
  
  riddenIndices.forEach(index => {
    const basePoints = attractions[index]?.points || 0;
    const rideCount = rideCounts[index] || 0;
    
    if (rideCount > 0) {
      let points = basePoints;
      
      // Verificar si es el que más veces se ha montado
      if (allUsers) {
        const maxRideCount = Math.max(...Object.values(allUsers).map(user => 
          user.rideCounts?.[index] || 0
        ));
        
        const usersWithMaxCount = Object.values(allUsers).filter(user => 
          (user.rideCounts?.[index] || 0) === maxRideCount && maxRideCount > 0
        );
        
        // Si este usuario está entre los que más veces se han montado
        if (rideCount === maxRideCount && maxRideCount > 0) {
          // Duplicar puntos si es el único, o dividir entre los que empatan
          if (usersWithMaxCount.length === 1) {
            points = basePoints * 2;
          } else {
            // En caso de empate, todos reciben la duplicación
            points = basePoints * 2;
          }
        }
      }
      
      totalPoints += points;
    }
  });
  
  return totalPoints;
}

// Funciones de renderizado de rankings
function renderOverallRanking() {
  const rankingList = document.getElementById('overall-ranking-list');
  rankingList.innerHTML = '';
  
  const ranking = Object.entries(allUsers).map(([username, data]) => ({
    username,
    ridden: data.ridden?.length || 0,
    points: calculatePointsWithBonuses(data.ridden || [], data.rideCounts || {}, allUsers)
  })).sort((a, b) => b.points - a.points);
  
  ranking.forEach((user, index) => {
    const li = document.createElement('li');
    
    // Add current user highlight
    if (currentUser && user.username === currentUser.username) {
      li.classList.add('current-user');
    }
    
    // Position badge
    const positionBadge = document.createElement('div');
    positionBadge.className = 'position-badge';
    
    if (index === 0) {
      positionBadge.classList.add('gold');
      positionBadge.innerHTML = '🥇';
    } else if (index === 1) {
      positionBadge.classList.add('silver');
      positionBadge.innerHTML = '🥈';
    } else if (index === 2) {
      positionBadge.classList.add('bronze');
      positionBadge.innerHTML = '🥉';
    } else {
      positionBadge.classList.add('other');
      positionBadge.textContent = index + 1;
    }
    
    // User info container
    const userInfo = document.createElement('div');
    userInfo.className = 'user-info';
    
    // Username
    const userName = document.createElement('div');
    userName.className = 'user-name';
    userName.textContent = user.username;
    
    // User stats
    const userStats = document.createElement('div');
    userStats.className = 'user-stats';
    userStats.textContent = `${user.ridden}/${attractions.length}`;
    
    // Points info
    const pointsInfo = document.createElement('div');
    pointsInfo.className = 'ranking-points';
    pointsInfo.textContent = `${user.points} puntos`;
    
    userInfo.appendChild(userName);
    userInfo.appendChild(userStats);
    userInfo.appendChild(pointsInfo);
    
    // Progress bar
    const progressContainer = document.createElement('div');
    progressContainer.className = 'ranking-progress';
    
    const progressFill = document.createElement('div');
    progressFill.className = 'ranking-progress-fill';
    const maxPoints = ranking.length > 0 ? ranking[0].points : 0;
    const progressPercentage = maxPoints > 0 ? (user.points / maxPoints) * 100 : 0;
    progressFill.style.width = `${progressPercentage}%`;
    
    progressContainer.appendChild(progressFill);
    
    // Score display
    const scoreDisplay = document.createElement('div');
    scoreDisplay.className = 'score-display';
    
    const scoreNumber = document.createElement('div');
    scoreNumber.className = 'score-number';
    scoreNumber.textContent = user.points;
    
    scoreDisplay.appendChild(scoreNumber);
    
    // Assemble the ranking item
    const rankingPosition = document.createElement('div');
    rankingPosition.className = 'ranking-position';
    rankingPosition.appendChild(positionBadge);
    rankingPosition.appendChild(userInfo);
    rankingPosition.appendChild(progressContainer);
    
    li.appendChild(rankingPosition);
    li.appendChild(scoreDisplay);
    
    rankingList.appendChild(li);
  });
}

function renderCrownLeaders() {
  const crownList = document.getElementById('crown-leaders-list');
  crownList.innerHTML = '';
  
  // Calcular coronas por usuario
  const crownCounts = {};
  
  Object.entries(allUsers).forEach(([username, data]) => {
    let crowns = 0;
    (data.ridden || []).forEach(index => {
      const rideCount = data.rideCounts?.[index] || 0;
      if (rideCount > 0) {
        const maxRideCount = Math.max(...Object.values(allUsers).map(user => 
          user.rideCounts?.[index] || 0
        ));
        
        const usersWithMaxCount = Object.values(allUsers).filter(user => 
          (user.rideCounts?.[index] || 0) === maxRideCount && maxRideCount > 0
        );
        
        // Solo contar coronas únicas (sin empates)
        if (rideCount === maxRideCount && maxRideCount > 0 && usersWithMaxCount.length === 1) {
          crowns++;
        }
      }
    });
    
    if (crowns > 0) {
      crownCounts[username] = crowns;
    }
  });
  
  // Ordenar por número de coronas
  const crownRanking = Object.entries(crownCounts)
    .map(([username, crowns]) => ({ username, crowns }))
    .sort((a, b) => b.crowns - a.crowns);
  
  crownRanking.forEach((user, index) => {
    const li = document.createElement('li');
    
    // Add current user highlight
    if (currentUser && user.username === currentUser.username) {
      li.classList.add('current-user');
    }
    
    // Position badge
    const positionBadge = document.createElement('div');
    positionBadge.className = 'position-badge';
    
    if (index === 0) {
      positionBadge.classList.add('gold');
      positionBadge.innerHTML = '👑';
    } else if (index === 1) {
      positionBadge.classList.add('silver');
      positionBadge.innerHTML = '🥈';
    } else if (index === 2) {
      positionBadge.classList.add('bronze');
      positionBadge.innerHTML = '🥉';
    } else {
      positionBadge.classList.add('other');
      positionBadge.textContent = index + 1;
    }
    
    // User info
    const userInfo = document.createElement('div');
    userInfo.className = 'user-info';
    
    const userName = document.createElement('div');
    userName.className = 'user-name';
    userName.textContent = user.username;
    
    const crownInfo = document.createElement('div');
    crownInfo.className = 'crown-info';
    crownInfo.textContent = `${user.crowns} coronas`;
    
    userInfo.appendChild(userName);
    userInfo.appendChild(crownInfo);
    
    li.appendChild(positionBadge);
    li.appendChild(userInfo);
    
    crownList.appendChild(li);
  });
}

function renderActivePlayers() {
  const activeList = document.getElementById('active-players-list');
  activeList.innerHTML = '';
  
  // Calcular total de veces montadas por usuario
  const activityCounts = {};
  
  Object.entries(allUsers).forEach(([username, data]) => {
    const totalRides = Object.values(data.rideCounts || {}).reduce((sum, count) => sum + count, 0);
    if (totalRides > 0) {
      activityCounts[username] = totalRides;
    }
  });
  
  // Ordenar por actividad
  const activityRanking = Object.entries(activityCounts)
    .map(([username, rides]) => ({ username, rides }))
    .sort((a, b) => b.rides - a.rides);
  
  activityRanking.forEach((user, index) => {
    const li = document.createElement('li');
    
    // Add current user highlight
    if (currentUser && user.username === currentUser.username) {
      li.classList.add('current-user');
    }
    
    // Position badge
    const positionBadge = document.createElement('div');
    positionBadge.className = 'position-badge';
    
    if (index === 0) {
      positionBadge.classList.add('gold');
      positionBadge.innerHTML = '🎢';
    } else if (index === 1) {
      positionBadge.classList.add('silver');
      positionBadge.innerHTML = '🥈';
    } else if (index === 2) {
      positionBadge.classList.add('bronze');
      positionBadge.innerHTML = '🥉';
    } else {
      positionBadge.classList.add('other');
      positionBadge.textContent = index + 1;
    }
    
    // User info
    const userInfo = document.createElement('div');
    userInfo.className = 'user-info';
    
    const userName = document.createElement('div');
    userName.className = 'user-name';
    userName.textContent = user.username;
    
    const ridesInfo = document.createElement('div');
    ridesInfo.className = 'rides-info';
    ridesInfo.textContent = `${user.rides} veces montadas`;
    
    userInfo.appendChild(userName);
    userInfo.appendChild(ridesInfo);
    
    li.appendChild(positionBadge);
    li.appendChild(userInfo);
    
    activeList.appendChild(li);
  });
}

function renderAttractionsChart() {
  const ctx = document.getElementById('attractions-chart-canvas');
  if (!ctx) return;
  
  // Destruir gráfico anterior si existe
  if (attractionsChart) {
    attractionsChart.destroy();
  }
  
  // Calcular total de veces montadas por atracción
  const attractionCounts = {};
  
  attractions.forEach((attr, index) => {
    let totalCount = 0;
    Object.values(allUsers).forEach(user => {
      totalCount += user.rideCounts?.[index] || 0;
    });
    attractionCounts[attr.name] = totalCount;
  });
  
  // Ordenar por número de veces montadas
  const sortedAttractions = Object.entries(attractionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10); // Top 10 atracciones
  
  const labels = sortedAttractions.map(([name]) => name);
  const data = sortedAttractions.map(([, count]) => count);
  
  attractionsChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Veces montadas',
        data: data,
        backgroundColor: 'rgba(54, 162, 235, 0.8)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          }
        }
      },
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });
}

function updateUserNameDisplay() {
  const userNameDisplay = document.getElementById('user-name-display-rankings');
  if (currentUser && userNameDisplay) {
    userNameDisplay.textContent = currentUser.username;
  }
}

// User Profile Functions
function setupUserProfile() {
  const userProfile = document.getElementById('user-profile-rankings');
  const userNameDisplay = document.getElementById('user-name-display-rankings');
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

function showRankings() {
  const rankingsElement = document.getElementById('rankings-app');
  
  rankingsElement.classList.remove('hidden');
  
  // Setup user profile
  setupUserProfile();
  
  // Setup navigation
  setupNavigation();
  
  // Render all rankings
  renderOverallRanking();
  renderCrownLeaders();
  renderActivePlayers();
  renderAttractionsChart();
  setupPlayerAttractionsChart();
}

async function loadAllUsers() {
  try {
    const snapshot = await dbRef.child('users').get();
    allUsers = snapshot.val() || {};
  } catch (error) {
    console.error('Error loading users:', error);
    allUsers = {};
  }
}

function goBack() {
  window.location.href = 'index.html';
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

// Setup navigation buttons when rankings app is shown
function setupNavigation() {
  const backButton = document.getElementById('back-button');
  const logoutButton = document.getElementById('logout-rankings');
  
  if (backButton) {
    backButton.onclick = goBack;
  }
  
  if (logoutButton) {
    logoutButton.onclick = logout;
  }
}

// Listen for real-time updates
dbRef.child('users').on('value', snapshot => {
  allUsers = snapshot.val() || {};
  
  if (currentUser && allUsers[currentUser.username]) {
    currentUser.ridden = allUsers[currentUser.username].ridden || [];
    currentUser.rideCounts = allUsers[currentUser.username].rideCounts || {};
  }
  
  // Update rankings if app is visible
  const rankingsElement = document.getElementById('rankings-app');
  if (rankingsElement && !rankingsElement.classList.contains('hidden')) {
    renderOverallRanking();
    renderCrownLeaders();
    renderActivePlayers();
    renderAttractionsChart();
    populatePlayerSelect();
    const select = document.getElementById('player-select');
    if (select) renderPlayerAttractionsChart(select.value);
  }
});

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

function populatePlayerSelect() {
  const select = document.getElementById('player-select');
  if (!select) return;
  select.innerHTML = '';
  Object.keys(allUsers).forEach(username => {
    const option = document.createElement('option');
    option.value = username;
    option.textContent = username;
    select.appendChild(option);
  });
  // Restaurar selección previa de cookies
  const lastSelected = getCookie('last_player_selected');
  if (lastSelected && allUsers[lastSelected]) {
    select.value = lastSelected;
  }
}

function renderPlayerAttractionsChart(username) {
  const ctx = document.getElementById('player-attractions-chart-canvas');
  if (!ctx) return;
  if (playerAttractionsChart) {
    playerAttractionsChart.destroy();
  }
  const user = allUsers[username];
  if (!user) return;
  // Calcular veces montadas por atracción para este usuario
  const rideCounts = user.rideCounts || {};
  const attractionCounts = attractions.map((attr, idx) => ({
    name: attr.name,
    count: rideCounts[idx] || 0
  }));
  // Ordenar por más montadas y tomar top 10
  const sorted = attractionCounts.sort((a, b) => b.count - a.count).slice(0, 10);
  const labels = sorted.map(a => a.name);
  const data = sorted.map(a => a.count);
  playerAttractionsChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Veces montadas',
        data: data,
        backgroundColor: 'rgba(255, 159, 64, 0.8)',
        borderColor: 'rgba(255, 159, 64, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 }
        }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function setupPlayerAttractionsChart() {
  const select = document.getElementById('player-select');
  if (!select) return;
  populatePlayerSelect();
  // Render inicial
  renderPlayerAttractionsChart(select.value);
  // Guardar selección en cookies y actualizar gráfico al cambiar
  select.onchange = function() {
    setCookie('last_player_selected', select.value, 365);
    renderPlayerAttractionsChart(select.value);
  };
} 
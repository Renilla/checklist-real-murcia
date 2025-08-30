let dbRef = firebase.database().ref();
let currentUser = null;
let attractions = [];
let categoryStates = {}; // Para almacenar el estado de las categorías

window.addEventListener('DOMContentLoaded', async () => {
  try {
    // Cargar atracciones una sola vez
    attractions = await fetch('attractions.json').then(r => r.json());
    
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
            ridden: userData.ridden || [],
            rideCounts: userData.rideCounts || {}
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

function loadCategoryStates() {
  try {
    const savedStates = localStorage.getItem('portaventura_category_states');
    if (savedStates) {
      categoryStates = JSON.parse(savedStates);
    }
  } catch (error) {
    console.error('Error loading category states:', error);
    categoryStates = {};
  }
}

function saveCategoryStates() {
  try {
    localStorage.setItem('portaventura_category_states', JSON.stringify(categoryStates));
  } catch (error) {
    console.error('Error saving category states:', error);
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
  setCookie('portaventura_session', { username, password });
}

function getSavedSession() {
  return getCookie('portaventura_session');
}

function clearSession() {
  deleteCookie('portaventura_session');
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
        
        renderAttractions();
        renderStats(window.allUsers);
        
        // Setup user profile functionality
        setupUserProfile();
        
        // Setup logout button
        document.getElementById('logout').onclick = logout;
        
        // Setup ranking button
        document.getElementById('ranking-button').onclick = goToRankings;
        
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

function renderAttractions() {
  const container = document.getElementById('categories-container');
  container.innerHTML = '';
  
  // Group attractions by category
  const categories = {};
  attractions.forEach((attr, index) => {
    if (!categories[attr.category]) {
      categories[attr.category] = [];
    }
    categories[attr.category].push({ ...attr, index });
  });
  
  // Create category sections
  Object.entries(categories).forEach(([categoryName, categoryAttractions], categoryIndex) => {
    const categorySection = document.createElement('div');
    categorySection.className = 'category-section';
    if (categoryName === 'PA DORMIRSE') {
      categorySection.classList.add('pa-dormirse');
    }
    
    // Category header
    const header = document.createElement('div');
    header.className = 'category-header';
    header.onclick = () => toggleCategory(categorySection, categoryName);
    
    const title = document.createElement('div');
    title.className = 'category-title';
    
    const colorDot = document.createElement('div');
    colorDot.className = `category-color ${categoryAttractions[0].color}`;
    
    const titleText = document.createElement('span');
    titleText.textContent = categoryName;
    
    title.appendChild(colorDot);
    title.appendChild(titleText);
    
    const arrow = document.createElement('div');
    arrow.className = 'category-arrow';
    arrow.innerHTML = '▼';
    
    header.appendChild(title);
    header.appendChild(arrow);
    
    // Category content
    const content = document.createElement('div');
    content.className = 'category-content';
    
    // Aplicar estado guardado
    const isCollapsed = categoryStates[categoryName] === true;
    if (isCollapsed) {
      header.classList.add('collapsed');
      content.classList.add('collapsed');
    }
    
    const attractionsList = document.createElement('ul');
    attractionsList.className = 'category-attractions';
    if (categoryName === 'PA DORMIRSE') {
      attractionsList.classList.add('pa-dormirse');
    }
    
    categoryAttractions.forEach((attr, attrIndex) => {
      const li = document.createElement('li');
      const isRidden = currentUser.ridden.includes(attr.index);
      const rideCount = currentUser.rideCounts[attr.index] || 0;
      
      const attractionInfo = document.createElement('div');
      attractionInfo.className = 'attraction-info';
      
      const name = document.createElement('span');
      name.className = 'attraction-name';
      name.textContent = attr.name;
      
      // Mostrar conteo de veces montadas si es mayor a 0
      if (rideCount > 0) {
        const rideCountBadge = document.createElement('span');
        rideCountBadge.className = 'ride-count-badge';
        
        // Aplicar tema de color basado en el número de veces montadas
        if (rideCount === 1) {
          rideCountBadge.classList.add('bronze');
        } else if (rideCount === 2) {
          rideCountBadge.classList.add('silver');
        } else if (rideCount >= 3) {
          rideCountBadge.classList.add('gold');
        }
        
        rideCountBadge.textContent = `×${rideCount}`;
        name.appendChild(rideCountBadge);
        
        // Verificar si es líder de esta atracción
        if (window.allUsers && Object.keys(window.allUsers).length > 0) {
          const maxRideCount = Math.max(...Object.values(window.allUsers).map(user => 
            user.rideCounts?.[attr.index] || 0
          ));
          
          const usersWithMaxCount = Object.values(window.allUsers).filter(user => 
            (user.rideCounts?.[attr.index] || 0) === maxRideCount && maxRideCount > 0
          );
          
          // Si este usuario es líder (tiene el máximo y es mayor a 0)
          if (rideCount === maxRideCount && maxRideCount > 0) {
            const leaderBadge = document.createElement('span');
            leaderBadge.className = usersWithMaxCount.length > 1 ? 'leader-badge tied' : 'leader-badge';
            leaderBadge.innerHTML = usersWithMaxCount.length > 1 ? '🤝' : '👑';
            leaderBadge.title = usersWithMaxCount.length > 1 ? 
              `Líder empatado (${usersWithMaxCount.length} usuarios)` : 
              'Líder de esta atracción';
            name.appendChild(leaderBadge);
          }
        }
      }
      
      const points = document.createElement('span');
      points.className = 'attraction-points';
      points.textContent = `${attr.points}p`;
      
      attractionInfo.appendChild(name);
      attractionInfo.appendChild(points);
      
      // Crear contenedor para botones
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'attraction-buttons';
      
      if (isRidden) {
        // Botones + y - cuando está marcada
        const minusBtn = document.createElement('button');
        minusBtn.className = 'minus-btn';
        minusBtn.innerHTML = '−';
        minusBtn.onclick = () => decrementRide(attr.index);
        
        const plusBtn = document.createElement('button');
        plusBtn.className = 'plus-btn';
        plusBtn.innerHTML = '+';
        plusBtn.onclick = () => incrementRide(attr.index);
        
        buttonContainer.appendChild(minusBtn);
        buttonContainer.appendChild(plusBtn);
      } else {
        // Botón "Marcar" cuando no está marcada
        const markBtn = document.createElement('button');
        markBtn.textContent = 'Marcar';
        markBtn.onclick = () => toggleRide(attr.index);
        buttonContainer.appendChild(markBtn);
      }
      
      li.appendChild(attractionInfo);
      li.appendChild(buttonContainer);
      
      // Add staggered animation
      li.style.opacity = '0';
      li.style.transform = 'translateY(20px)';
      
      attractionsList.appendChild(li);
      
      // Animate in with delay
      setTimeout(() => {
        li.style.transition = 'all 0.3s ease-out';
        li.style.opacity = '1';
        li.style.transform = 'translateY(0)';
      }, (categoryIndex * 100) + (attrIndex * 50));
    });
    
    content.appendChild(attractionsList);
    categorySection.appendChild(header);
    categorySection.appendChild(content);
    container.appendChild(categorySection);
  });
  
  document.getElementById('total-attractions').textContent = attractions.length;
  

}

function toggleCategory(categorySection, categoryName) {
  const header = categorySection.querySelector('.category-header');
  const content = categorySection.querySelector('.category-content');
  
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

function calculateCrownsAndHandshakes(user, allUsers = null) {
  let crowns = 0;
  let handshakes = 0;
  
  if (!allUsers || !user.ridden) {
    return { crowns, handshakes };
  }
  
  user.ridden.forEach(index => {
    const rideCount = user.rideCounts?.[index] || 0;
    if (rideCount > 0) {
      const maxRideCount = Math.max(...Object.values(allUsers).map(u => 
        u.rideCounts?.[index] || 0
      ));
      
      const usersWithMaxCount = Object.values(allUsers).filter(u => 
        (u.rideCounts?.[index] || 0) === maxRideCount && maxRideCount > 0
      );
      
      // Si este usuario es líder de esta atracción
      if (rideCount === maxRideCount && maxRideCount > 0) {
        if (usersWithMaxCount.length === 1) {
          // Corona única
          crowns++;
        } else {
          // Handshake por empate
          handshakes++;
        }
      }
    }
  });
  
  return { crowns, handshakes };
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

function renderStats(users = null) {
  const riddenCount = (currentUser.ridden || []).length;
  const totalPoints = calculatePointsWithBonuses(currentUser.ridden || [], currentUser.rideCounts || {}, users);
  const totalAttractions = attractions.length;
  const attractionPct = (riddenCount / totalAttractions) * 100;
  
  // Calculate crowns and handshakes
  const { crowns, handshakes } = calculateCrownsAndHandshakes(currentUser, users);
  
  document.getElementById('ridden-count').textContent = riddenCount;
  document.getElementById('total-points').textContent = totalPoints;
  document.getElementById('total-attractions').textContent = totalAttractions;
  document.getElementById('crowns-count').textContent = crowns;
  document.getElementById('handshakes-count').textContent = handshakes;
  
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

  if (users) {
    const ranking = Object.entries(users).map(([username, data]) => ({
      username,
      ridden: data.ridden?.length || 0,
      points: calculatePointsWithBonuses(data.ridden || [], data.rideCounts || {}, users)
    })).sort((a, b) => b.points - a.points);

    const ol = document.getElementById('ranking-list');
    ol.innerHTML = '';
    
    const maxPointsRanking = ranking.length > 0 ? ranking[0].points : 0;
    
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
      const progressPercentage = maxPointsRanking > 0 ? (user.points / maxPointsRanking) * 100 : 0;
      progressFill.style.width = `${progressPercentage}%`;
      
      // Calculate total possible points
      const totalPossiblePoints = attractions.reduce((total, attr) => total + attr.points, 0);
      
      // Add complete class only if user has ALL possible points
      if (user.points >= totalPossiblePoints) {
        progressFill.classList.add('complete');
      }
      
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
      
      // Add staggered animation
      li.style.opacity = '0';
      li.style.transform = 'translateY(20px)';
      
      ol.appendChild(li);
      
      // Animate in with delay
      setTimeout(() => {
        li.style.transition = 'all 0.3s ease-out';
        li.style.opacity = '1';
        li.style.transform = 'translateY(0)';
      }, index * 100);
    });
  }
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
    
    // Prepare update data
    const updateData = {};
    
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

// Navigation function for rankings page
function goToRankings() {
  window.location.href = 'rankings.html';
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
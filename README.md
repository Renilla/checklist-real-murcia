# PortAventura - Contador de Montañas Rusas

## Cambios Recientes - Separación del Login

### Resumen de Cambios

Se ha implementado la separación del formulario de login en un archivo HTML independiente y un sistema de redirección basado en sesiones.

### Archivos Modificados/Creados

#### Nuevos Archivos:
- `login.html` - Formulario de login separado
- `.htaccess` - Configuración de caché y redirecciones
- `README.md` - Este archivo de documentación

#### Archivos Modificados:

1. **index.html**
   - Eliminado el formulario de login
   - Agregado loading spinner durante verificación de sesión
   - Redirección automática a login.html si no hay sesión válida

2. **script.js**
   - Modificada la verificación inicial de sesión
   - Eliminadas funciones de autenticación (movidas a login.html)
   - Modificada función logout para redirigir a login.html
   - Agregada redirección automática si no hay sesión válida

3. **rankings.html** y **logros.html**
   - Agregada verificación de sesión al cargar
   - Redirección automática a login.html si no hay sesión válida

4. **rankings.js** y **logros.js**
   - Agregada verificación de sesión al inicio
   - Modificadas funciones logout para redirigir a login.html
   - Eliminados eventos DOMContentLoaded duplicados

5. **registro.html**
   - Modificado enlace "Inicia Sesión" para apuntar a login.html
   - Modificada redirección post-registro para ir a login.html

6. **styles.css**
   - Agregados estilos para el loading spinner

### Flujo de Autenticación

1. **Acceso Directo a Páginas Protegidas:**
   - `index.html`, `rankings.html`, `logros.html`
   - Verificación automática de sesión al cargar
   - Si no hay sesión válida → redirección a `login.html`

2. **Login (login.html):**
   - Formulario de autenticación independiente
   - Validación de credenciales contra Firebase
   - Opción "Recordar sesión" (cookies)
   - Redirección a `index.html` tras login exitoso

3. **Registro (registro.html):**
   - Formulario de registro independiente
   - Validación de datos y verificación de usuario existente
   - Redirección a `login.html` tras registro exitoso

4. **Logout:**
   - Limpieza de sesión y cookies
   - Redirección a `login.html`

### Características del Sistema

- **Persistencia de Sesión:** Cookies con opción de recordar
- **Seguridad:** Validación de credenciales en cada página protegida
- **UX Mejorada:** Loading spinner durante verificación
- **Redirecciones Inteligentes:** Flujo coherente entre páginas
- **Manejo de Errores:** Redirección automática en caso de errores

### Estructura de Archivos

```
peroleta_to_PA/
├── index.html          # Página principal (protegida)
├── login.html          # Formulario de login
├── registro.html       # Formulario de registro
├── rankings.html       # Rankings (protegida)
├── logros.html         # Logros (protegida)
├── script.js           # Lógica principal
├── rankings.js         # Lógica de rankings
├── logros.js           # Lógica de logros
├── styles.css          # Estilos CSS
├── attractions.json    # Datos de atracciones
├── .htaccess          # Configuración de servidor
└── README.md          # Documentación
```

### Notas Técnicas

- **Cookies:** Sesiones almacenadas en cookies con encriptación
- **Firebase:** Autenticación y almacenamiento de datos
- **Responsive:** Diseño adaptativo para móviles
- **PWA:** Configuración para Progressive Web App

### Compatibilidad

- Navegadores modernos con soporte para ES6+
- Firebase 9.x
- Servidores web con soporte para .htaccess (Apache) 
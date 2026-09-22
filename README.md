# Sanos y Salvos - Frontend

Frontend oficial de la plataforma Sanos y Salvos, construido con React y Vite. Su responsabilidad es presentar las vistas de usuario y administración, coordinar la navegación protegida y consumir el backend mediante el API Gateway utilizando HTTP.

## Descripción

Este frontend permite a usuarios autenticados registrar mascotas, consultar sus mascotas, visualizar coincidencias y revisar el detalle de cada mascota. También incluye un área administrativa para gestionar usuarios, mascotas, coincidencias y un dashboard con indicadores operativos.

La aplicación no mantiene persistencia propia ni implementa lógica de negocio de servidor. Todo acceso a datos se realiza mediante servicios HTTP centralizados que consumen el API Gateway configurado en `VITE_API_BASE_URL`, el cual enruta las solicitudes hacia los microservicios correspondientes.

## Arquitectura

La aplicación sigue una arquitectura de presentación organizada por dominios funcionales y separación clara de responsabilidades.

### Capas principales

- `src/main.jsx`: punto de entrada; monta `AuthProvider` y la aplicación React.
- `src/App.jsx`: delega el enrutamiento al router principal.
- `src/routes`: define las rutas, el acceso protegido y la separación entre vistas públicas, de usuario y administrativas.
- `src/context`: contiene el estado global de autenticación.
- `src/hooks`: expone hooks reutilizables sobre contexto y estado global.
- `src/services`: encapsula las llamadas HTTP al API Gateway por dominio funcional.
- `src/api`: configura la instancia compartida de Axios.
- `src/pages`: vistas principales del usuario autenticado.
- `src/admin`: vistas y layout del área administrativa.
- `src/components`: componentes reutilizables de interfaz, navegación y mapa.
- `src/layouts`: layouts de nivel de aplicación.
- `src/styles`: estilos globales y por módulo.
- `src/assets`: recursos estáticos como el logo.

### Layouts y composición

La app principal usa `AppLayout`, que compone `Navbar`, `Sidebar`, `Footer` y un `Outlet` para renderizar la vista activa. Este layout también controla la apertura del menú lateral en móvil y adapta la navegación según el rol.

El área administrativa usa `AdminLayout`, que agrupa el encabezado del panel y una navegación interna hacia Dashboard, Usuarios, Mascotas y Coincidencias.

### Separación por dominio

- `src/pages/Inicio.jsx`: vista principal con mapa, búsqueda, filtros y listado de mascotas.
- `src/pages/RegistrarMascota.jsx`: formulario de registro de mascotas con selección de ubicación y validación geográfica.
- `src/pages/MisMascotas.jsx`: listado de mascotas del usuario con edición y eliminación.
- `src/pages/Coincidencias.jsx`: vista de coincidencias asociadas al usuario autenticado.
- `src/pages/MascotaDetalle.jsx`: detalle de una mascota y formulario local de reporte ciudadano.
- `src/admin/pages/*`: vistas administrativas para dashboard, usuarios, mascotas y coincidencias.

### Responsabilidad de carpetas

- `src/components/layout`: barra superior, sidebar y footer globales.
- `src/components/mapa`: mapa Leaflet y tarjetas de mascotas para la vista de inicio.
- `src/components/roles`: tarjetas informativas de perfiles visibles en el dashboard general.
- `src/context`: contexto de sesión autenticada y persistencia en `localStorage`.
- `src/services`: capa de acceso a API por caso de uso.
- `src/routes`: navegación y reglas de acceso.
- `src/styles`: estilos globales, autenticación, dashboard, layout y registro de mascota.

## Tecnologías

| Tecnología | Uso real en el proyecto |
| --- | --- |
| React | Biblioteca principal de UI |
| React DOM | Renderizado en navegador |
| React Router DOM | Ruteo y protección de rutas |
| Axios | Cliente HTTP hacia el API Gateway |
| Vite | Herramienta de desarrollo y build |
| JavaScript | Lenguaje principal del frontend |
| CSS | Estilos globales y por pantalla |
| Bootstrap | Dependencia instalada en el proyecto |
| Leaflet | Motor de mapas |
| React Leaflet | Integración React del mapa |
| ESLint | Linter del proyecto |

## Arquitectura tecnológica

El frontend fue desarrollado siguiendo una arquitectura basada en componentes, donde cada responsabilidad se encuentra separada en módulos independientes.

### Flujo general

```text
                Usuario
                    │
                    ▼
          Frontend (React + Vite)
                    │
                    ▼
          React Router + Context API
                    │
                    ▼
            Servicios HTTP (Axios)
                    │
                    ▼
              API Gateway (VITE_API_BASE_URL)
                    │
     ┌──────────────┼──────────────┐
     ▼              ▼              ▼
 ms-usuarios   ms-mascotas   ms-coincidencias
                    │
                    ▼
           ms-geolocalizacion
```

### Componentes principales

- **React** para la construcción de la interfaz de usuario.
- **React Router DOM** para el manejo de rutas públicas y protegidas.
- **Context API** para administrar el estado global de autenticación.
- **Axios** para centralizar todas las solicitudes HTTP.
- **API Gateway** como único punto de acceso al backend.
- **Leaflet** para la visualización de mapas interactivos.
- **Bootstrap** para apoyar el diseño responsivo de la interfaz.


## Comunicación con Backend

La comunicación con el backend se centraliza en la instancia de Axios definida en `src/api/axiosConfig.js`.

Todas las solicitudes se realizan al **API Gateway**, configurado mediante `VITE_API_BASE_URL`. El Gateway es el único punto de entrada del sistema y se encarga de redirigir cada petición al microservicio correspondiente.

La instancia Axios agrega automáticamente el encabezado:

```http
Authorization: Bearer {token}
```

cuando existe una cuenta Microsoft activa; el Access Token se obtiene mediante MSAL y no se almacena manualmente en `localStorage`.

Todas las llamadas funcionales pasan por servicios ubicados en `src/services` o, en algunos flujos de edición y eliminación, usan directamente la misma instancia Axios. Las rutas observadas consumen el prefijo `/bff`, por ejemplo:

- `/bff/usuarios/login`
- `/bff/usuarios`
- `/bff/mascotas`
- `/bff/mascotas/usuario/{id}`
- `/bff/coincidencias`
- `/bff/coincidencias/usuario/{id}`
- `/bff/geolocalizacion`

Aunque el prefijo `/bff` se mantiene por compatibilidad con el proyecto original, actualmente las solicitudes son atendidas por el API Gateway, que redirige cada petición al microservicio correspondiente.

La aplicación maneja la sesión con `AuthContext`, que obtiene los datos locales vinculados mediante `GET /bff/usuarios/me`. `ProtectedRoute` espera la inicialización de MSAL y valida la sesión local vinculada y el rol antes de permitir acceso a rutas privadas.

## Seguridad

La autenticación normal se basa en Microsoft Entra ID mediante MSAL. El backend valida el Access Token en cada solicitud protegida.

Una vez autenticado el usuario:

- MSAL mantiene su propia caché de sesión.
- Axios obtiene silenciosamente un Access Token de Microsoft e incorpora el encabezado `Authorization: Bearer {token}` en cada solicitud.
- `ProtectedRoute` verifica la existencia del token y el rol del usuario antes de permitir el acceso a rutas privadas o administrativas.

## Funcionalidades

- Inicio de sesión con redirección por rol.
- Registro de usuarios.
- Cierre de sesión.
- Visualización del inicio con mapa de mascotas y marcadores.
- Búsqueda y filtrado de mascotas por tipo, color, estado y dimensión.
- Visualización del detalle de una mascota.
- Reporte ciudadano local desde el detalle de mascota.
- Registro de mascota con imagen y ubicación geográfica.
- Búsqueda de dirección y selección de ubicación en mapa.
- Validación de ubicación para la comuna de Maipú en el registro de mascota.
- Listado de mascotas del usuario autenticado.
- Edición de mascotas del usuario.
- Eliminación de mascotas del usuario.
- Visualización de coincidencias del usuario autenticado.
- Dashboard administrativo con KPIs de usuarios, mascotas y coincidencias.
- Gestión administrativa de usuarios.
- Gestión administrativa de mascotas.
- Gestión administrativa de coincidencias.
- Filtrado administrativo de coincidencias por usuario.
- Visualización de perfiles del sistema en el dashboard general.
- Consumo centralizado del backend mediante API Gateway.
- Protección de rutas mediante autenticación JWT.

## Cambios realizados para la evaluación

En esta entrega se actualizó completamente la documentación del frontend en `README.md` usando únicamente información existente en el repositorio.

- Se describió la arquitectura real del proyecto por carpetas y responsabilidades.
- Se documentaron las tecnologías efectivamente instaladas y usadas.
- Se explicaron las rutas, layouts y el flujo de navegación.
- Se documentó el consumo del API Gateway y la gestión de autenticación mediante Axios y localStorage.
- Se enumeraron las funcionalidades realmente implementadas en las vistas y servicios.
- Se incorporó la estructura real del proyecto sin inventar módulos ni dependencias.

## Flujo de navegación

1. El usuario accede a `/login` o `/register`.
2. Tras autenticarse, `Login` redirige según el rol:
   - `ADMIN` -> `/admin/dashboard`
   - resto de roles autenticados -> `/inicio`
3. La ruta raíz `/` redirige a `/inicio`.
4. Las rutas privadas están envueltas por `ProtectedRoute` y `AppLayout`.
5. El usuario navega desde el sidebar o el navbar hacia:
   - `/inicio`
   - `/registrar-mascota`
   - `/mis-mascotas`
   - `/coincidencias`
   - `/mascota/:id`
6. El usuario administrador entra al bloque `/admin` y navega entre:
   - `/admin/dashboard`
   - `/admin/users`
   - `/admin/mascotas`
   - `/admin/coincidencias`
7. Si una ruta no coincide con la configuración, el router redirige a la vista de inicio correspondiente.

## Estructura del proyecto

```text
.
├── index.html
├── package.json
├── README.md
├── eslint.config.js
├── vite.config.js
├── public/
│   ├── favicon.svg
│   ├── icons.svg
│   └── logo.png
└── src/
    ├── App.jsx
    ├── index.css
    ├── main.jsx
    ├── admin/
    │   ├── layout/
    │   │   └── AdminLayout.jsx
    │   └── pages/
    │       ├── AdminCoincidencias.jsx
    │       ├── AdminDashboard.jsx
    │       ├── AdminMascotas.jsx
    │       └── AdminUsers.jsx
    ├── api/
    │   └── axiosConfig.js
    ├── assets/
    │   └── logo.png
    ├── components/
    │   ├── Navbar.jsx
    │   ├── layout/
    │   │   ├── Footer.jsx
    │   │   ├── Navbar.jsx
    │   │   └── Sidebar.jsx
    │   ├── mapa/
    │   │   ├── MascotaCard.jsx
    │   │   └── MascotasMap.jsx
    │   └── roles/
    │       ├── AdminPanel.jsx
    │       ├── ClinicaPanel.jsx
    │       ├── RefugioPanel.jsx
    │       └── UsuarioPanel.jsx
    ├── context/
    │   └── AuthContext.jsx
    ├── hooks/
    │   └── useAuth.js
    ├── layouts/
    │   └── AppLayout.jsx
    ├── pages/
    │   ├── Coincidencias.jsx
    │   ├── Dashboard.jsx
    │   ├── Inicio.jsx
    │   ├── Login.jsx
    │   ├── MascotaDetalle.jsx
    │   ├── MisMascotas.jsx
    │   ├── Register.jsx
    │   └── RegistrarMascota.jsx
    ├── routes/
    │   ├── AppRouter.jsx
    │   └── ProtectedRoute.jsx
    ├── services/
    │   ├── adminService.js
    │   ├── authService.js
    │   ├── coincidenciaService.js
    │   ├── geolocalizacionService.js
    │   └── mascotaService.js
    └── styles/
        ├── auth.css
        ├── dashboard.css
        ├── layout.css
        └── registrar-mascota.css
```

## Instalación

```bash
npm install
```
Si el proyecto se instala desde cero, las principales dependencias utilizadas son:

```bash
npm install bootstrap
npm install axios
npm install react-router-dom
npm install leaflet react-leaflet
```

Posteriormente inicia el proyecto:

```bash
npm run dev
```

Para generar el build de producción:

```bash
npm run build
```

Para revisar el proyecto con ESLint:

```bash
npm run lint
```

Para previsualizar el build localmente:

```bash
npm run preview
```

## Variables de entorno

La URL del backend se configura mediante la variable `VITE_API_BASE_URL` en `.env` o `.env.example`. Axios, `AuthContext` y las pruebas temporales de `Login.jsx` utilizan esa misma base para acceder al API Gateway.

## Scripts

| Script | Descripción |
| --- | --- |
| `npm run dev` | Inicia el servidor de desarrollo con Vite |
| `npm run build` | Genera la compilación de producción |
| `npm run lint` | Ejecuta ESLint sobre el código fuente |
| `npm run preview` | Levanta una vista previa local del build |

## Autores

Matilda Isabel Vargas Canseco
Juan Fernando Vargas Castillo
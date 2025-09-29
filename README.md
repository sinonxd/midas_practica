# Midas Dashboard API

Este es un proyecto de API construido con Node.js y Express. Sirve datos a un dashboard de frontend y se conecta a una base de datos PostgreSQL.

## Características

- API RESTful con un endpoint para obtener datos.
- Frontend para visualización de datos.
- Configuración basada en variables de entorno.

## Estructura del Proyecto

```
.
├── frontend/
│   ├── app.js
│   ├── index.html
│   ├── styles.css
│   └── wordcloud2.min.js
├── .env
├── .gitignore
├── index.js
├── package-lock.json
├── package.json
└── README.md
```

## Prerrequisitos

- [Node.js](https://nodejs.org/) (versión 14 o superior)
- [NPM](https://www.npmjs.com/)
- Una instancia de [PostgreSQL](https://www.postgresql.org/) en ejecución.

## Instalación

1.  Clona este repositorio:

    ```bash
    git clone <URL_DEL_REPOSITORIO>
    cd midas-dashboard-api
    ```

2.  Instala las dependencias del proyecto:
    ```bash
    npm install
    ```

## Configuración

1.  Crea un archivo `.env` en la raíz del proyecto. Puedes copiar el archivo `.env.example` si existe o crearlo desde cero.

2.  Añade las siguientes variables de entorno al archivo `.env` con los datos de tu base de datos PostgreSQL:

    ```
    PGHOST=localhost
    PGPORT=5432
    PGDATABASE=nombre_de_tu_base_de_datos
    PGUSER=tu_usuario_de_postgres
    PGPASSWORD=tu_contraseña_de_postgres
    PORT=3000
    ```

3.  Asegúrate de que tu base de datos PostgreSQL tenga una tabla llamada `busquedas_clasificadas_v2` con al menos las siguientes columnas:
    - `fecha` (DATE o TIMESTAMP)
    - `tipo_busqueda` (TEXT o VARCHAR)
    - `criterio_texto` (TEXT o VARCHAR)

## Uso

Para iniciar el servidor, ejecuta el siguiente comando:

```bash
node index.js
```

El servidor se iniciará en el puerto especificado en la variable de entorno `PORT` (por defecto, 3000).

Puedes acceder al frontend abriendo tu navegador y visitando `http://localhost:3000`.

## Endpoints de la API

### GET /api/data

Recupera datos de la base de datos.

- **URL:** `/api/data`
- **Método:** `GET`
- **Parámetros de Consulta:**

  - `start` (opcional): Fecha de inicio para filtrar los resultados (formato `YYYY-MM-DD` o `DD/MM/YYYY`).
  - `end` (opcional): Fecha de fin para filtrar los resultados (formato `YYYY-MM-DD` o `DD/MM/YYYY`).

- **Respuesta Exitosa (200):**

  ```json
  {
    "data": [
      {
        "fecha": "2025-09-29T00:00:00.000Z",
        "tipo_busqueda": "ejemplo",
        "criterio_texto": "un criterio de búsqueda"
      }
    ]
  }
  ```

- **Respuesta de Error (500):**

  ```json
  {
    "error": "Mensaje de error"
  }
  ```

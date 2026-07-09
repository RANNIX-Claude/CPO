# CPO Portfolio Manager

Sistema de gestión de iniciativas y proyectos para un grupo empresarial multi-empresa. Ver [ARQUITECTURA.md](ARQUITECTURA.md) para el detalle completo de esquema, RLS y decisiones de diseño.

## Setup en 5 pasos

1. **Base de datos**: crea un proyecto en [supabase.com](https://supabase.com), ve a SQL Editor y ejecuta el contenido completo de `supabase/schema.sql` una sola vez (crea tablas, RLS, storage y datos de prueba).

2. **Variables de entorno**: copia `.env.example` a `.env` y llena `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` desde Project Settings → API en tu proyecto Supabase.

3. **Instalar y correr localmente**:
   ```
   npm install
   npm run dev
   ```

4. **Primer login y alta de admin**: entra a la app, haz login con Google. Como no tendrás perfil, verás la pantalla de "Solicitud de acceso" — envíala. Luego, en el SQL Editor de Supabase, ejecuta:
   ```sql
   UPDATE personas SET auth_user_id = (SELECT id FROM auth.users WHERE email = 'tu-email@dominio.com')
     WHERE email = 'tu-email@dominio.com';
   INSERT INTO user_roles (auth_user_id, persona_id, rol)
     SELECT auth_user_id, id, 'admin' FROM personas WHERE email = 'tu-email@dominio.com';
   ```
   (El seed ya incluye una persona con nivel director para `roberto.aguilar.cota@gmail.com`; si es tu correo, solo corre el script de arriba tal cual.)

5. **Deploy en Netlify**: conecta este repo de GitHub a un sitio nuevo en Netlify (Import from Git). En Site settings → Environment variables agrega `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `ANTHROPIC_API_KEY` (para la función de prototipado con Claude). A partir de ahí, cada `git push` a `main` despliega automáticamente.

## Stack

React 18 + Vite · React Router v6 · Supabase (auth + db + storage) · Recharts · Netlify + Functions.

## Estructura

Ver `src/` para componentes/páginas y `supabase/schema.sql` para el esquema completo con RLS.

# Supabase

La migración `migrations/202608170001_initial_marketplace.sql` crea el modelo inicial de Fixo:

- perfiles y roles;
- postulación y estados de técnicos;
- categorías, solicitudes y auditoría administrativa;
- políticas RLS y bucket privado para documentos de verificación.

## Aplicar la migración

1. Abre el proyecto en Supabase y entra a **SQL Editor**.
2. Crea una nueva consulta.
3. Copia el contenido completo de la migración y ejecútalo una sola vez.
4. En **Authentication → URL Configuration**, agrega la URL local y la URL de producción de Fixo a las Redirect URLs. Para desarrollo local usa `http://localhost:3000/login`.

## Primeros administradores

Después de crear los usuarios en Authentication, actualiza su rol desde SQL Editor:

```sql
update public.profiles as profiles
set role = 'superadmin'
from auth.users as users
where profiles.id = users.id
  and lower(users.email) in ('admin@ejemplo.cl');
```

Puedes usar `moderator` para administradores con permisos operativos más acotados.

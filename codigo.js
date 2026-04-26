//Configuración de supabase
const SUPABASE_URL     = 'https://qlrzkgitmhettkyuzgkr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFscnprZ2l0bWhldHRreXV6Z2tyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNTk5ODksImV4cCI6MjA5MjYzNTk4OX0.JdQFhwdaHIMVnQXWbuvxx2sIBf8L3s_D5Q-NljhPpCg';

const sbClient = window.supabase.createClient('https://qlrzkgitmhettkyuzgkr.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFscnprZ2l0bWhldHRreXV6Z2tyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNTk5ODksImV4cCI6MjA5MjYzNTk4OX0.JdQFhwdaHIMVnQXWbuvxx2sIBf8L3s_D5Q-NljhPpCg');

//Estado global de la aplicación
const state = {
    currentUser:              null,
    users:                    [],
    projects:                 [],
    tasks:                    [],
    isRegisteringMainAdmin:   false
};

//Controlador principal
const app = {

    // Inicio
    init: async () => {
        await app.checkUsersExistence();
        document.getElementById('login-form').addEventListener('submit', app.handleAuth);
    },

    // Checa si hay al menos un usuario registrado
    checkUsersExistence: async () => {
        const { data, error } = await sbClient.from('tb_usuario').select('id');

        if (error || !data) {
            console.error('Error al conectar con la base de datos:', error);
            return;
        }

        if (data.length === 0) {
            app.showRegisterMain();
        }
    },

    // Es para registrar el administrador principal
    showRegisterMain: () => {
        state.isRegisteringMainAdmin = true;
        document.getElementById('login-title').innerText    = 'Crear Administrador Principal';
        document.getElementById('name-group').style.display = 'block';
        document.getElementById('toggle-auth').style.display = 'none';
        document.getElementById('btn-auth').innerText        = 'Crear Cuenta Principal';
    },

    // Maneja el Login o Registro inicial
    handleAuth: async (e) => {
        e.preventDefault();
        const email    = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const btn      = document.getElementById('btn-auth');

        // Deshabilitar botón mientras procesa
        btn.disabled = true;
        btn.innerText = 'Comprobando...';
        app.showLoginError('');

        if (state.isRegisteringMainAdmin) {
            const nombre = document.getElementById('reg-name').value.trim();
            if (!nombre) {
                btn.disabled = false; btn.innerText = 'Crear Cuenta Principal';
                return app.showLoginError('Por favor ingresa tu nombre completo.');
            }

            const { data, error } = await sbClient
                .from('tb_usuario')
                .insert([{ nombre_completo: nombre, correo: email, contrasena: password, rol: 'Admin Principal' }])
                .select();

            btn.disabled = false; btn.innerText = 'Crear Cuenta Principal';
            if (error) return app.showLoginError('Error al crear cuenta: ' + error.message);

            state.currentUser = data[0];
            await app.loginSuccess();

        } else {
            const { data, error } = await sbClient
                .from('tb_usuario')
                .select('*')
                .eq('correo', email)
                .eq('contrasena', password);

            btn.disabled = false; btn.innerText = 'Entrar';

            if (error) return app.showLoginError('Error de conexión: ' + error.message);
            if (!data || data.length === 0) return app.showLoginError('Correo o contraseña incorrectos.');

            state.currentUser = data[0];
            await app.loginSuccess();
        }
    },

    // Muestra un mensaje de error en el formulario de login
    showLoginError: (msg) => {
        const el = document.getElementById('login-error');
        if (!el) return;
        if (!msg) { el.style.display = 'none'; el.innerText = ''; return; }
        el.innerText = msg;
        el.style.display = 'block';
    },

    // Acciones posteriores a un inicio de sesión 
    loginSuccess: async () => {
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('app-container').style.display   = 'flex';

        document.getElementById('active-user-name').innerText = state.currentUser.nombre_completo;
        document.getElementById('active-user-role').innerText = state.currentUser.rol;

        if (state.currentUser.rol === 'Admin Principal') {
            document.getElementById('menu-users').style.display = 'block';
        }

        await app.loadData();

        // Es para que classList.add('active') no falle al no haber un `event` disponible.
        const firstMenuItem = document.querySelector('.menu li');
        await app.view('dashboard', firstMenuItem);
    },

    // Cierra la sesión y recarga la página
    logout: () => {
        state.currentUser = null;
        window.location.reload();
    },

    // Sistema interno
    //         Si se llama desde un onclick en el HTML, se puede pasar `this` como segundo argumento.
    view: async (section, sourceElement) => {
        // Quitar clase active de todos los ítems del menú
        document.querySelectorAll('.menu li').forEach(li => li.classList.remove('active'));

        // Marcar como activo el elemento origen (si existe)
        const target = sourceElement || (typeof event !== 'undefined' && event.currentTarget) || null;
        if (target) target.classList.add('active');

        const content = document.getElementById('main-content');

        switch (section) {
            case 'dashboard':
                await app.renderDashboard(content);
                break;
            case 'proyectos':
                app.renderProjects(content);
                break;
            case 'tareas':
                app.renderTasks(content);
                break;
            case 'usuarios':
                if (state.currentUser.rol === 'Admin Principal') app.renderUsers(content);
                break;
        }
    },

    // Carga todos los datos desde Supabase al estado local
    loadData: async () => {
        const [usersReq, projectsReq, tasksReq] = await Promise.all([
            sbClient.from('tb_usuario').select('*'),
            sbClient.from('tb_proyecto').select('*'),
            sbClient.from('tb_tarea').select('*')
        ]);

        state.users    = usersReq.data    || [];
        state.projects = projectsReq.data || [];
        state.tasks    = tasksReq.data    || [];
    }
};

// Arranca el sistema al cargar
window.onload = app.init;

// Lógica

// Generador de ID para Proyectos (100, 200, 300…)
app.generateProjectId = () => {
    if (state.projects.length === 0) return 100;
    const maxId = Math.max(...state.projects.map(p => p.id));
    return Math.floor(maxId / 100) * 100 + 100;
};

// Generador de ID para Tareas 
app.generateTaskId = (projectId) => {
    const projectTasks = state.tasks.filter(t => t.id_proyecto === projectId);
    if (projectTasks.length === 0) return projectId + 1;
    const maxId = Math.max(...projectTasks.map(t => t.id));
    return maxId + 1;
};

//         calculateProjectProgress() solo calcula; persistProjectProgress() guarda.
app.calculateProjectProgress = (projectId) => {
    const projectTasks = state.tasks.filter(t => t.id_proyecto === projectId);
    if (projectTasks.length === 0) return 0;

    let totalProgress = 0;
    projectTasks.forEach(task => {
        if (task.estatus === 'Completado') {
            totalProgress += 100;
        } else if (task.estatus === 'En Progreso') {
            totalProgress += (task.avance_escala || 0) * 10;
        }
        // 'Pendiente' suma 0
    });

    return Math.round(totalProgress / projectTasks.length);
};

// Sigue el progreso calculado en Supabase (llamar solo al cambiar una tarea)
app.persistProjectProgress = async (projectId) => {
    const progress = app.calculateProjectProgress(projectId);
    const { error } = await sbClient
        .from('tb_proyecto')
        .update({ progreso: progress })
        .eq('id', projectId);

    if (error) console.error('Error al actualizar progreso:', error);
    return progress;
};

// Vistas

// Dashboard General
app.renderDashboard = async (container) => {
    container.innerHTML = '<p style="color:#666; padding:20px">Cargando proyectos...</p>';

    let visibleProjects = state.projects;

    // Filtro RBAC: cada rol ve solo lo que le corresponde
    if (state.currentUser.rol === 'Administrador') {
        visibleProjects = state.projects.filter(p =>
            p.creador_id === state.currentUser.id ||
            (p.admins_asignados && p.admins_asignados.includes(state.currentUser.id))
        );
    } else if (state.currentUser.rol === 'Desarrollador') {
        const myProjectIds = state.tasks
            .filter(t => t.id_usuario === state.currentUser.id)
            .map(t => t.id_proyecto);
        visibleProjects = state.projects.filter(p => myProjectIds.includes(p.id));
    }

    let html = `<h2>Dashboard de Operaciones</h2><hr><br><div class="card-grid">`;

    if (visibleProjects.length === 0) {
        html += `<p>No hay proyectos disponibles para su visualización.</p>`;
    } else {
        visibleProjects.forEach(p => {
            const progress = app.calculateProjectProgress(p.id);
            html += `
                <div class="project-card">
                    <h3 style="color: var(--primary-color);">[ID: ${p.id}] ${p.nombre_proyecto}</h3>
                    <p style="margin-top: 10px; font-size: 0.9em; color: #666;">${p.descripcion || ''}</p>
                    <p style="margin-top: 10px;"><strong>Estado:</strong> ${p.estado || '—'}</p>
                    <div class="progress-bar-container">
                        <div class="progress-bar" style="width: ${progress}%;"></div>
                    </div>
                    <p style="text-align: right; font-weight: bold;">Avance: ${progress}%</p>
                </div>
            `;
        });
    }

    html += `</div>`;
    container.innerHTML = html;
};

// Gestión de Proyectos
app.renderProjects = (container) => {
    let html = `<h2>Gestión de Proyectos</h2><hr><br>`;

    if (state.currentUser.rol === 'Admin Principal' || state.currentUser.rol === 'Administrador') {
        html += `
            <button onclick="alert('Funcionalidad: Abrir modal de nuevo proyecto')"
                    style="padding: 10px; background: var(--accent-color); color: white;
                           border: none; border-radius: 5px; cursor: pointer; margin-bottom: 20px;">
                + Crear Nuevo Proyecto
            </button>`;
    } else {
        html += `<p style="color: #666; margin-bottom: 20px;">
                    <em>Como desarrollador, usted solo tiene permisos de visualización en este apartado.</em>
                 </p>`;
    }

    if (state.projects.length === 0) {
        html += `<p>No hay proyectos registrados.</p>`;
    } else {
        html += `
            <table style="width:100%; border-collapse:collapse; background:white; border-radius:8px; overflow:hidden; box-shadow:0 2px 4px rgba(0,0,0,.06)">
                <thead>
                    <tr style="background:var(--primary-color); color:white; font-size:12px; text-transform:uppercase; letter-spacing:.5px">
                        <th style="padding:10px 14px; text-align:left">ID</th>
                        <th style="padding:10px 14px; text-align:left">Proyecto</th>
                        <th style="padding:10px 14px; text-align:left">Tecnologías</th>
                        <th style="padding:10px 14px; text-align:left">Estado</th>
                        <th style="padding:10px 14px; text-align:left">Avance</th>
                    </tr>
                </thead>
                <tbody>`;

        state.projects.forEach(p => {
            const progress = app.calculateProjectProgress(p.id);
            html += `
                <tr style="border-bottom:1px solid #eee">
                    <td style="padding:10px 14px; font-family:monospace; color:#888">${p.id}</td>
                    <td style="padding:10px 14px; font-weight:500">${p.nombre_proyecto}</td>
                    <td style="padding:10px 14px; color:#666; font-size:13px">${p.tecnologias || '—'}</td>
                    <td style="padding:10px 14px">${p.estado || '—'}</td>
                    <td style="padding:10px 14px">
                        <div class="progress-bar-container">
                            <div class="progress-bar" style="width:${progress}%"></div>
                        </div>
                        <small>${progress}%</small>
                    </td>
                </tr>`;
        });

        html += `</tbody></table>`;
    }

    container.innerHTML = html;
};

// Gestión de Tareas
app.renderTasks = (container) => {
    let html = `<h2>Gestión de Tareas y Asignaciones</h2><hr><br>`;

    const isAdmin = state.currentUser.rol === 'Admin Principal' || state.currentUser.rol === 'Administrador';
    const myTasks = isAdmin
        ? state.tasks
        : state.tasks.filter(t => t.id_usuario === state.currentUser.id);

    if (myTasks.length === 0) {
        html += `<p>No hay tareas asignadas en este momento.</p>`;
    } else {
        // Agrupar por estatus
        const grupos = { 'Pendiente': [], 'En Progreso': [], 'Completado': [] };
        myTasks.forEach(t => {
            const key = grupos[t.estatus] ? t.estatus : 'Pendiente';
            grupos[key].push(t);
        });

        html += `<div style="display:grid; grid-template-columns:repeat(3,1fr); gap:16px">`;

        const colores = { 'Pendiente': '#e67e22', 'En Progreso': '#3498db', 'Completado': '#2ecc71' };

        Object.entries(grupos).forEach(([estatus, tareas]) => {
            html += `
                <div style="background:white; border-radius:10px; padding:14px; box-shadow:0 2px 4px rgba(0,0,0,.06)">
                    <div style="font-size:11px; font-weight:600; letter-spacing:.5px; text-transform:uppercase;
                                color:${colores[estatus]}; margin-bottom:12px;">
                        ${estatus} <span style="background:${colores[estatus]}22; color:${colores[estatus]};
                        padding:1px 8px; border-radius:20px; font-size:10px">${tareas.length}</span>
                    </div>`;

            if (tareas.length === 0) {
                html += `<p style="font-size:12px; color:#aaa; font-style:italic; text-align:center; padding:12px 0">Sin tareas</p>`;
            } else {
                tareas.forEach(t => {
                    const proyecto = state.projects.find(p => p.id === t.id_proyecto);
                    const usuario  = state.users.find(u => u.id === t.id_usuario);
                    html += `
                        <div style="background:#f9f9f9; border:1px solid #eee; border-radius:8px; padding:10px; margin-bottom:8px">
                            <div style="font-family:monospace; font-size:10px; color:#aaa; margin-bottom:3px">#${t.id}</div>
                            <div style="font-size:10px; color:var(--accent-color); margin-bottom:5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">
                                ${proyecto ? proyecto.nombre_proyecto : '—'}
                            </div>
                            <div style="font-size:12px; line-height:1.5; margin-bottom:6px">${t.descripcion || ''}</div>
                            <div style="font-size:10px; color:#888">👤 ${usuario ? usuario.nombre_completo : '—'}</div>
                        </div>`;
                });
            }
            html += `</div>`;
        });

        html += `</div>`;
    }

    container.innerHTML = html;
};

// Gestión de Usuarios (Solo disponible para el Admin Principal)
app.renderUsers = (container) => {
    if (state.currentUser.rol !== 'Admin Principal') return;

    let html = `<h2>Control de Acceso y Usuarios</h2><hr><br>
        <div style="background:white; padding:20px; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,.06)">
            <p>Usuarios registrados en el sistema:</p>
            <ul style="margin-top:15px; margin-left:20px;">`;

    state.users.forEach(u => {
        const esMismoUsuario = u.id === state.currentUser.id;
        html += `
            <li style="margin-bottom:10px">
                <strong>${u.nombre_completo}</strong> — ${u.rol}
                ${!esMismoUsuario
                    ? `<button onclick="app.deleteUser(${u.id})"
                              style="background:var(--danger); color:white; border:none;
                                     padding:3px 8px; border-radius:3px; cursor:pointer;
                                     margin-left:10px; font-size:0.8em;">
                          Eliminar
                       </button>`
                    : '<span style="font-size:0.8em; color:#aaa; margin-left:8px">(tú)</span>'}
            </li>`;
    });

    html += `</ul></div>`;
    container.innerHTML = html;
};

// Eliminar usuario desde la vista de usuarios
app.deleteUser = async (userId) => {
    if (!confirm('¿Estás seguro de eliminar este usuario?')) return;

    const { error } = await sbClient.from('tb_usuario').delete().eq('id', userId);
    if (error) return alert('Error al eliminar: ' + error.message);

    state.users = state.users.filter(u => u.id !== userId);
    app.renderUsers(document.getElementById('main-content'));
};

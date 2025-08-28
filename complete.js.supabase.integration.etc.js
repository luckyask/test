// Initialize Supabase with your credentials
const supabaseUrl = 'https://qjswuwcqyzeuqqqltykz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqc3d1d2NxeXpldXFxcWx0eWt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyMjk0MDUsImV4cCI6MjA3MDgwNTQwNX0.qgH8DMJEoJVuYOXSyr0RAj01Yt7bBR8EYL6qw3YXyAs';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Global variables
let currentUser = null;
let currentCompanyId = null;
let currentSubscriptionTier = 'starter';
let calendar = null;

// Authentication state listener
supabase.auth.onAuthStateChange(async (event, session) => {
  if (session?.user) {
    currentUser = session.user;
    await loadUserCompanyData();
    initializeTaskFlow();
  } else {
    // Redirect to login or show login UI
    console.log('User not authenticated');
  }
});

async function loadUserCompanyData() {
  // Get user's company and subscription data
  const { data, error } = await supabase
    .from('user_companies')
    .select('company_id, companies(subscription_tier)')
    .eq('user_id', currentUser.id)
    .single();
  
  if (data) {
    currentCompanyId = data.company_id;
    currentSubscriptionTier = data.companies.subscription_tier;
  }
}

// CRUD Operations for Tasks
async function createTask(taskData) {
  const { data, error } = await supabase
    .from('tasks')
    .insert([{...taskData, company_id: currentCompanyId, created_by: currentUser.id}])
    .select();
  
  if (error) {
    console.error('Error creating task:', error);
    showNotification('Failed to create task', 'error');
    return null;
  }
  
  showNotification('Task created successfully!', 'success');
  return data[0];
}

async function getTasks(filters = {}) {
  let query = supabase
    .from('tasks')
    .select('*, projects(name), users(full_name)')
    .eq('company_id', currentCompanyId);
  
  // Apply filters
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.project_id) query = query.eq('project_id', filters.project_id);
  if (filters.assigned_to) query = query.eq('assigned_to', filters.assigned_to);
  
  const { data, error } = await query.order('due_date', { ascending: true });
  
  if (error) {
    console.error('Error fetching tasks:', error);
    return [];
  }
  
  return data;
}

async function updateTask(taskId, updates) {
  const { data, error } = await supabase
    .from('tasks')
    .update({ ...updates, updated_at: new Date() })
    .eq('id', taskId)
    .select();
  
  if (error) {
    console.error('Error updating task:', error);
    showNotification('Failed to update task', 'error');
    return null;
  }
  
  showNotification('Task updated successfully!', 'success');
  return data[0];
}

async function deleteTask(taskId) {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId);
  
  if (error) {
    console.error('Error deleting task:', error);
    showNotification('Failed to delete task', 'error');
    return false;
  }
  
  showNotification('Task deleted successfully!', 'success');
  return true;
}

// CRUD Operations for Events
async function createEvent(eventData) {
  const { data, error } = await supabase
    .from('events')
    .insert([{...eventData, company_id: currentCompanyId, created_by: currentUser.id}])
    .select();
  
  if (error) {
    console.error('Error creating event:', error);
    showNotification('Failed to create event', 'error');
    return null;
  }
  
  showNotification('Event created successfully!', 'success');
  return data[0];
}

async function getEvents(startDate, endDate) {
  const { data, error } = await supabase
    .from('events')
    .select('*, projects(name), users(full_name)')
    .eq('company_id', currentCompanyId)
    .gte('start_time', startDate.toISOString())
    .lte('start_time', endDate.toISOString())
    .order('start_time', { ascending: true });
  
  if (error) {
    console.error('Error fetching events:', error);
    return [];
  }
  
  return data;
}

async function updateEvent(eventId, updates) {
  const { data, error } = await supabase
    .from('events')
    .update({ ...updates, updated_at: new Date() })
    .eq('id', eventId)
    .select();
  
  if (error) {
    console.error('Error updating event:', error);
    showNotification('Failed to update event', 'error');
    return null;
  }
  
  showNotification('Event updated successfully!', 'success');
  return data[0];
}

async function deleteEvent(eventId) {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId);
  
  if (error) {
    console.error('Error deleting event:', error);
    showNotification('Failed to delete event', 'error');
    return false;
  }
  
  showNotification('Event deleted successfully!', 'success');
  return true;
}

// TaskFlow initialization
function initializeTaskFlow() {
  loadTasksAndEvents();
  setupEventListeners();
  checkSubscriptionTier();
}

async function loadTasksAndEvents() {
  // Load tasks
  const tasks = await getTasks();
  renderTasks(tasks);
  
  // Load events for the current month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  const events = await getEvents(startOfMonth, endOfMonth);
  renderEvents(events);
}

function renderTasks(tasks) {
  const taskList = document.getElementById('task-list');
  if (!taskList) return;
  
  taskList.innerHTML = '';
  
  tasks.forEach(task => {
    const taskItem = document.createElement('li');
    taskItem.className = 'task-item';
    taskItem.dataset.taskId = task.id;
    
    const dueDate = task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date';
    const projectName = task.projects ? task.projects.name : 'No project';
    const assignedTo = task.users ? task.users.full_name : 'Unassigned';
    
    taskItem.innerHTML = `
      <div class="task-checkbox">
        <input type="checkbox" ${task.status === 'completed' ? 'checked' : ''}>
      </div>
      <div class="task-content">
        <div class="task-title">${task.title}</div>
        <div class="task-desc">${task.description || 'No description'}</div>
        <div class="task-meta">
          <span>Due: ${dueDate}</span>
          <span>Project: ${projectName}</span>
          <span>Assigned to: ${assignedTo}</span>
          <span class="task-priority priority-${task.priority || 'medium'}">${task.priority || 'Medium'} Priority</span>
        </div>
      </div>
      <div class="task-actions">
        <button class="edit-task" title="Edit"><i>✏️</i></button>
        <button class="delete-task" title="Delete"><i>🗑️</i></button>
      </div>
    `;
    
    taskList.appendChild(taskItem);
  });
  
  // Update task count
  const totalTasksEl = document.querySelector('.card-value');
  if (totalTasksEl) {
    totalTasksEl.textContent = tasks.length;
  }
}

function renderEvents(events) {
  if (!calendar) return;
  
  // Clear existing events
  calendar.getEvents().forEach(event => event.remove());
  
  // Add new events
  events.forEach(event => {
    calendar.addEvent({
      id: event.id,
      title: event.title,
      start: event.start_time,
      end: event.end_time,
      allDay: event.all_day,
      color: getEventColor(event.event_type)
    });
  });
}

function getEventColor(eventType) {
  const colors = {
    'meeting': '#3B82F6',
    'deadline': '#EF4444',
    'inspection': '#10B981',
    'milestone': '#F59E0B',
    'general': '#1E3A8A'
  };
  
  return colors[eventType] || '#1E3A8A';
}

function setupEventListeners() {
  // Event form submission
  const saveEventBtn = document.getElementById('save-event');
  if (saveEventBtn) {
    saveEventBtn.addEventListener('click', handleEventSave);
  }
  
  // Task form submission
  const saveTaskBtn = document.getElementById('save-task');
  if (saveTaskBtn) {
    saveTaskBtn.addEventListener('click', handleTaskSave);
  }
  
  // Task completion toggle
  document.addEventListener('change', function(e) {
    if (e.target.matches('.task-checkbox input')) {
      const taskItem = e.target.closest('.task-item');
      const taskId = taskItem.dataset.taskId;
      const isCompleted = e.target.checked;
      
      const updates = {
        status: isCompleted ? 'completed' : 'pending',
        completed_at: isCompleted ? new Date() : null
      };
      
      updateTask(taskId, updates).then(success => {
        if (!success) {
          e.target.checked = !isCompleted; // Revert UI if update failed
        } else {
          if (isCompleted) {
            taskItem.style.opacity = '0.7';
            taskItem.style.textDecoration = 'line-through';
          } else {
            taskItem.style.opacity = '1';
            taskItem.style.textDecoration = 'none';
          }
        }
      });
    }
  });
  
  // Edit and delete task buttons
  document.addEventListener('click', function(e) {
    if (e.target.closest('.edit-task')) {
      const taskItem = e.target.closest('.task-item');
      const taskId = taskItem.dataset.taskId;
      // Implement edit functionality
      console.log('Edit task:', taskId);
    }
    
    if (e.target.closest('.delete-task')) {
      const taskItem = e.target.closest('.task-item');
      const taskId = taskItem.dataset.taskId;
      
      if (confirm('Are you sure you want to delete this task?')) {
        deleteTask(taskId).then(success => {
          if (success) {
            taskItem.remove();
          }
        });
      }
    }
  });
  
  // Filter functionality
  const projectFilter = document.getElementById('project-filter');
  const statusFilter = document.getElementById('status-filter');
  
  if (projectFilter) {
    projectFilter.addEventListener('change', filterTasks);
  }
  
  if (statusFilter) {
    statusFilter.addEventListener('change', filterTasks);
  }
}

async function handleEventSave() {
  const form = document.getElementById('event-form');
  if (!form) return;
  
  const formData = new FormData(form);
  const eventData = {
    title: formData.get('title'),
    description: formData.get('description'),
    start_time: formData.get('start_time'),
    end_time: formData.get('end_time'),
    project_id: formData.get('project_id'),
    event_type: formData.get('event_type') || 'general'
  };
  
  const event = await createEvent(eventData);
  if (event) {
    calendar.addEvent({
      id: event.id,
      title: event.title,
      start: event.start_time,
      end: event.end_time,
      allDay: event.all_day,
      color: getEventColor(event.event_type)
    });
    
    document.getElementById('event-modal').style.display = 'none';
    form.reset();
  }
}

async function handleTaskSave() {
  const form = document.getElementById('task-form');
  if (!form) return;
  
  const formData = new FormData(form);
  const taskData = {
    title: formData.get('title'),
    description: formData.get('description'),
    due_date: formData.get('due_date'),
    priority: formData.get('priority'),
    project_id: formData.get('project_id')
  };
  
  const task = await createTask(taskData);
  if (task) {
    // Add the new task to the DOM
    const tasks = await getTasks();
    renderTasks(tasks);
    
    document.getElementById('task-modal').style.display = 'none';
    form.reset();
  }
}

async function filterTasks() {
  const projectValue = document.getElementById('project-filter')?.value || 'all';
  const statusValue = document.getElementById('status-filter')?.value || 'all';
  
  const filters = {};
  if (projectValue !== 'all') filters.project_id = projectValue;
  if (statusValue !== 'all') filters.status = statusValue;
  
  const tasks = await getTasks(filters);
  renderTasks(tasks);
}

function checkSubscriptionTier() {
  if (currentSubscriptionTier === 'pro' || currentSubscriptionTier === 'enterprise') {
    enableTeamFeatures();
  }
}

function enableTeamFeatures() {
  // Enable team assignment selects
  document.querySelectorAll('.team-assign-select').forEach(select => {
    select.disabled = false;
    
    // Load team members
    loadTeamMembers().then(members => {
      select.innerHTML = '<option value="">Select Team Member</option>' +
        members.map(m => `<option value="${m.id}">${m.full_name}</option>`).join('');
    });
  });
  
  // Show sync button
  const syncBtn = document.getElementById('sync-calendar-btn');
  if (syncBtn) {
    syncBtn.classList.remove('hidden');
    
    // Set up calendar sync
    syncBtn.addEventListener('click', setupCalendarSync);
  }
}

async function loadTeamMembers() {
  // Get users from the same company
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('company_id', currentCompanyId);
  
  if (error) {
    console.error('Error loading team members:', error);
    return [];
  }
  
  return data;
}

function setupCalendarSync() {
  // This would integrate with Google Calendar API
  // For now, we'll show a placeholder
  showNotification('Calendar sync requires additional setup with Google API', 'info');
}

function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <span>${message}</span>
    <button class="notification-close">&times;</button>
  `;
  
  // Add styles if not already added
  if (!document.getElementById('notification-styles')) {
    const styles = document.createElement('style');
    styles.id = 'notification-styles';
    styles.textContent = `
      .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 5px;
        color: white;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-width: 300px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        animation: slideIn 0.3s ease;
      }
      
      .notification-success { background-color: #10B981; }
      .notification-error { background-color: #EF4444; }
      .notification-info { background-color: #3B82F6; }
      .notification-warning { background-color: #F59E0B; }
      
      .notification-close {
        background: none;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        margin-left: 15px;
      }
      
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(styles);
  }
  
  // Add to page
  document.body.appendChild(notification);
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 5000);
  
  // Close button
  notification.querySelector('.notification-close').addEventListener('click', () => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  });
}

// Your existing DOMContentLoaded code
document.addEventListener('DOMContentLoaded', function() {
    // Mobile menu toggle
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    
    if (mobileMenuToggle && sidebar) {
        mobileMenuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
        });
    }
    
    // Menu toggle for dashboard
    const dashboardMenuToggle = document.querySelector('.dashboard-page .menu-toggle');
    
    if (dashboardMenuToggle && sidebar) {
        dashboardMenuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
        });
    }
    
    // Sidebar toggle button
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
        });
    }
    
    // Modal functionality
    const modalTriggers = document.querySelectorAll('[data-modal]');
    const modals = document.querySelectorAll('.modal');
    
    modalTriggers.forEach(trigger => {
        trigger.addEventListener('click', function() {
            const modalId = this.getAttribute('data-modal');
            const modal = document.getElementById(modalId);
            
            if (modal) {
                modal.classList.add('active');
                document.body.style.overflow = 'hidden';
            }
        });
    });
    
    modals.forEach(modal => {
        const closeButton = modal.querySelector('.modal-close');
        
        if (closeButton) {
            closeButton.addEventListener('click', function() {
                modal.classList.remove('active');
                document.body.style.overflow = '';
            });
        }
        
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    });
    
    // Photo upload functionality
    const uploadArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    const uploadPreview = document.getElementById('upload-preview');
    const startUploadBtn = document.getElementById('start-upload-btn');
    
    if (uploadArea && fileInput) {
        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, preventDefaults, false);
            document.body.addEventListener(eventName, preventDefaults, false);
        });
        
        // Highlight drop area when item is dragged over it
        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, highlight, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, unhighlight, false);
        });
        
        // Handle dropped files
        uploadArea.addEventListener('drop', handleDrop, false);
        
        // Handle click to select files
        uploadArea.addEventListener('click', function() {
            fileInput.click();
        });
        
        // Handle file selection
        fileInput.addEventListener('change', handleFiles);
    }
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    function highlight() {
        uploadArea.classList.add('highlight');
    }
    
    function unhighlight() {
        uploadArea.classList.remove('highlight');
    }
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles({ target: { files } });
    }
    
    function handleFiles(e) {
        const files = e.target.files;
        
        if (files.length > 0) {
            startUploadBtn.disabled = false;
            
            // Clear previous previews
            uploadPreview.innerHTML = '';
            
            // Display previews
            Array.from(files).forEach(file => {
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    
                    reader.onload = function(e) {
                        const previewItem = document.createElement('div');
                        previewItem.className = 'upload-preview-item';
                        
                        const img = document.createElement('img');
                        img.src = e.target.result;
                        
                        const removeBtn = document.createElement('button');
                        removeBtn.innerHTML = '&times;';
                        removeBtn.addEventListener('click', function() {
                            previewItem.remove();
                            
                            if (uploadPreview.children.length === 0) {
                                startUploadBtn.disabled = true;
                            }
                        });
                        
                        previewItem.appendChild(img);
                        previewItem.appendChild(removeBtn);
                        uploadPreview.appendChild(previewItem);
                    }
                    
                    reader.readAsDataURL(file);
                }
            });
        }
    }
    
    // Task priority colors
    const prioritySelect = document.getElementById('task-priority');
    
    if (prioritySelect) {
        prioritySelect.addEventListener('change', function() {
            const taskModal = this.closest('.modal');
            const priority = this.value.toLowerCase();
            
            // Remove all priority classes
            taskModal.classList.remove('priority-high', 'priority-medium', 'priority-low');
            
            // Add the selected priority class
            if (priority !== 'normal') {
                taskModal.classList.add(`priority-${priority}`);
            }
        });
    }
    
    // Calendar initialization
    const calendarEl = document.getElementById('calendar');
    
    if (calendarEl) {
        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            events: [
                {
                    title: 'Submit Building Permit',
                    start: new Date(),
                    color: '#EF4444'
                },
                {
                    title: 'Client Meeting',
                    start: '2023-06-15T10:00:00',
                    end: '2023-06-15T11:30:00',
                    color: '#3B82F6'
                },
                {
                    title: 'Electrical Inspection',
                    start: '2023-06-18T13:00:00',
                    color: '#10B981'
                }
            ],
            dateClick: function(info) {
                const selectedDateEl = document.getElementById('selected-date');
                if (selectedDateEl) {
                    selectedDateEl.textContent = info.dateStr;
                }
                
                // Open event modal with pre-filled date
                const eventModal = document.getElementById('event-modal');
                if (eventModal) {
                    const startInput = eventModal.querySelector('input[type="datetime-local"]');
                    if (startInput) {
                        startInput.value = info.dateStr + 'T09:00:00';
                    }
                    eventModal.classList.add('active');
                }
            }
        });
        
        calendar.render();
    }
    
    // Chart initialization
    const timeChartEl = document.getElementById('timeChart');
    
    if (timeChartEl) {
        const timeChart = new Chart(timeChartEl, {
            type: 'bar',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Hours Tracked',
                    data: [6.5, 8, 7.5, 9, 6, 0, 0],
                    backgroundColor: '#1E3A8A',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Hours'
                        }
                    }
                }
            }
        });
    }
    
    const progressChartEl = document.getElementById('progressChart');
    
    if (progressChartEl) {
        const progressChart = new Chart(progressChartEl, {
            type: 'doughnut',
            data: {
                labels: ['Completed', 'In Progress', 'Not Started'],
                datasets: [{
                    data: [35, 45, 20],
                    backgroundColor: [
                        '#10B981',
                        '#3B82F6',
                        '#E5E7EB'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                },
                cutout: '70%'
            }
        });
    }
    
    const taskChartEl = document.getElementById('taskChart');
    
    if (taskChartEl) {
        const taskChart = new Chart(taskChartEl, {
            type: 'line',
            data: {
                labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                datasets: [{
                    label: 'Tasks Completed',
                    data: [12, 19, 15, 24],
                    borderColor: '#F97316',
                    backgroundColor: 'rgba(249, 115, 22, 0.1)',
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
    
    const financialChartEl = document.getElementById('financialChart');
    
    if (financialChartEl) {
        const financialChart = new Chart(financialChartEl, {
            type: 'bar',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [
                    {
                        label: 'Revenue',
                        data: [12000, 19000, 15000, 18000, 22000, 24500],
                        backgroundColor: '#1E3A8A',
                        borderRadius: 4
                    },
                    {
                        label: 'Expenses',
                        data: [8000, 12000, 10000, 11000, 15000, 13000],
                        backgroundColor: '#F97316',
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Amount ($)'
                        }
                    }
                }
            }
        });
    }
    
    // Form validation
    const forms = document.querySelectorAll('form');
    
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Simple validation - check required fields
            const requiredInputs = this.querySelectorAll('[required]');
            let isValid = true;
            
            requiredInputs.forEach(input => {
                if (!input.value.trim()) {
                    input.style.borderColor = '#EF4444';
                    isValid = false;
                } else {
                    input.style.borderColor = '';
                }
            });
            
            if (isValid) {
                // Form is valid, show success message
                showNotification('Form submitted successfully!', 'success');
                this.reset();
            } else {
                showNotification('Please fill in all required fields.', 'error');
            }
        });
    });
    
    // Input validation
    const inputs = document.querySelectorAll('input, textarea, select');
    
    inputs.forEach(input => {
        input.addEventListener('input', function() {
            if (this.hasAttribute('required') && this.value.trim()) {
                this.style.borderColor = '';
            }
        });
    });
    
    // Password strength indicator
    const passwordInput = document.getElementById('password');
    
    if (passwordInput) {
        passwordInput.addEventListener('input', function() {
            const strengthMeter = this.closest('.form-group').querySelector('.strength-meter');
            const strengthText = this.closest('.form-group').querySelector('.strength-text');
            
            if (strengthMeter && strengthText) {
                const strengthBars = strengthMeter.querySelectorAll('.strength-bar');
                const password = this.value;
                let strength = 0;
                
                // Reset all bars
                strengthBars.forEach(bar => {
                    bar.style.backgroundColor = '#E5E7EB';
                });
                
                // Check password strength
                if (password.length >= 8) strength++;
                if (password.match(/[A-Z]/)) strength++;
                if (password.match(/[0-9]/)) strength++;
                if (password.match(/[^A-Za-z0-9]/)) strength++;
                
                // Update UI
                if (password.length > 0) {
                    for (let i = 0; i < strength; i++) {
                        if (i === 0) {
                            strengthBars[i].style.backgroundColor = '#EF4444';
                            strengthText.textContent = 'Password strength: Weak';
                        } else if (i === 1) {
                            strengthBars[i].style.backgroundColor = '#F59E0B';
                            strengthText.textContent = 'Password strength: Moderate';
                        } else if (i >= 2) {
                            strengthBars[i].style.backgroundColor = '#10B981';
                            strengthText.textContent = 'Password strength: Strong';
                        }
                    }
                } else {
                    strengthText.textContent = 'Password strength:';
                }
            }
        });
    }
    
    // Calculate estimate totals
    const lineItemsTable = document.querySelector('.line-items-table');
    
    if (lineItemsTable) {
        lineItemsTable.addEventListener('input', function(e) {
            if (e.target.matches('input[type="number"]')) {
                const row = e.target.closest('.table-row');
                const qtyInput = row.querySelector('input[type="number"]:nth-of-type(1)');
                const priceInput = row.querySelector('input[type="number"]:nth-of-type(2)');
                const totalCell = row.querySelector('.table-col:nth-last-child(2)');
                
                if (qtyInput && priceInput && totalCell) {
                    const qty = parseFloat(qtyInput.value) || 0;
                    const price = parseFloat(priceInput.value) || 0;
                    const total = qty * price;
                    
                    totalCell.textContent = '$' + total.toFixed(2);
                    
                    // Update grand total
                    updateEstimateTotal();
                }
            }
        });
        
        // Add new line item
        const addLineItemBtn = document.getElementById('add-line-item');
        
        if (addLineItemBtn) {
            addLineItemBtn.addEventListener('click', function(e) {
                e.preventDefault();
                
                const tableBody = lineItemsTable.querySelector('.table-body');
                const newRow = document.createElement('div');
                newRow.className = 'table-row';
                
                newRow.innerHTML = `
                    <div class="table-col">
                        <input type="text" placeholder="Item name">
                    </div>
                    <div class="table-col">
                        <input type="text" placeholder="Description">
                    </div>
                    <div class="table-col">
                        <input type="number" placeholder="Qty" value="1">
                    </div>
                    <div class="table-col">
                        <input type="number" placeholder="Unit Price" value="0">
                    </div>
                    <div class="table-col">
                        <span>$0.00</span>
                    </div>
                    <div class="table-col actions">
                        <button class="btn btn-icon">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
                
                tableBody.appendChild(newRow);
                
                // Add event listener to delete button
                const deleteBtn = newRow.querySelector('.btn-icon');
                deleteBtn.addEventListener('click', function() {
                    newRow.remove();
                    updateEstimateTotal();
                });
            });
        }
        
        // Add discount
        const addDiscountBtn = document.getElementById('add-discount');
        
        if (addDiscountBtn) {
            addDiscountBtn.addEventListener('click', function(e) {
                e.preventDefault();
                
                const totalsContainer = document.querySelector('.estimate-totals');
                const discountRow = document.createElement('div');
                discountRow.className = 'totals-row';
                
                discountRow.innerHTML = `
                    <span>Discount (5%)</span>
                    <span>-$0.00</span>
                `;
                
                totalsContainer.insertBefore(discountRow, totalsContainer.querySelector('.grand-total'));
            });
        }
        
        // Add tax
        const addTaxBtn = document.getElementById('add-tax');
        
        if (addTaxBtn) {
            addTaxBtn.addEventListener('click', function(e) {
                e.preventDefault();
                
                const totalsContainer = document.querySelector('.estimate-totals');
                const taxRow = document.createElement('div');
                taxRow.className = 'totals-row';
                
                taxRow.innerHTML = `
                    <span>Tax (7%)</span>
                    <span>$0.00</span>
                `;
                
                totalsContainer.insertBefore(taxRow, totalsContainer.querySelector('.grand-total'));
            });
        }
    }
    
    function updateEstimateTotal() {
        const subtotalRow = document.querySelector('.estimate-totals .totals-row:first-child');
        const discountRow = document.querySelector('.estimate-totals .totals-row:nth-child(2)');
        const taxRow = document.querySelector('.estimate-totals .totals-row:nth-child(3)');
        const grandTotalRow = document.querySelector('.estimate-totals .grand-total');
        
        if (subtotalRow && grandTotalRow) {
            // Calculate subtotal
            let subtotal = 0;
            const totalCells = document.querySelectorAll('.line-items-table .table-col:nth-last-child(2)');
            
            totalCells.forEach(cell => {
                const value = parseFloat(cell.textContent.replace('$', '')) || 0;
                subtotal += value;
            });
            
            subtotalRow.querySelector('span:last-child').textContent = '$' + subtotal.toFixed(2);
            
            // Calculate discount (5%)
            if (discountRow) {
                const discount = subtotal * 0.05;
                discountRow.querySelector('span:last-child').textContent = '-$' + discount.toFixed(2);
                subtotal -= discount;
            }
            
            // Calculate tax (7%)
            if (taxRow) {
                const tax = subtotal * 0.07;
                taxRow.querySelector('span:last-child').textContent = '$' + tax.toFixed(2);
                subtotal += tax;
            }
            
            // Update grand total
            grandTotalRow.querySelector('span:last-child').textContent = '$' + subtotal.toFixed(2);
        }
    }
    
    // Toggle billing period
    const billingToggle = document.querySelector('.billing-toggle input');
    const monthlyPrices = document.querySelectorAll('.price .amount');
    const annualPrices = ['268', '758', '1910'];
    
    if (billingToggle) {
        billingToggle.addEventListener('change', function() {
            monthlyPrices.forEach((priceEl, index) => {
                if (this.checked) {
                    priceEl.textContent = annualPrices[index];
                } else {
                    const monthlyPrice = priceEl.getAttribute('data-monthly') || 
                                        priceEl.textContent.replace(/[^0-9]/g, '');
                    priceEl.textContent = monthlyPrice;
                }
            });
        });
    }
    
    // Initialize monthly prices data attribute
    if (monthlyPrices.length > 0) {
        monthlyPrices.forEach(priceEl => {
            priceEl.setAttribute('data-monthly', priceEl.textContent);
        });
    }
});
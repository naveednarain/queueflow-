'use client'

import { useState } from 'react'
import {
  Shield,
  Building2,
  Users,
  Layers,
  Sliders,
  FileText,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Search,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Bell,
  Clock,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import BackButton from '@/components/back-button'
import {
  updateUserRole,
  updateDepartmentRules,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  createService,
  updateService,
  deleteService,
  triggerSystemMaintenance,
  type AdminData,
  type AdminUserItem,
  type AdminDepartmentItem,
  type AdminServiceItem,
  type AdminRuleItem,
} from '@/lib/actions/admin'

interface Props {
  initialData: AdminData
  adminEmail: string
}

export default function AdminPanelClient({ initialData, adminEmail }: Props) {
  const [data, setData] = useState<AdminData>(initialData)
  const [activeTab, setActiveTab] = useState<'departments' | 'users' | 'services' | 'rules' | 'logs'>('departments')
  const [searchQuery, setSearchQuery] = useState('')
  const [runningMaintenance, setRunningMaintenance] = useState(false)

  // ── Modals State ─────────────────────────────────────────────
  // Department Modal
  const [deptModalOpen, setDeptModalOpen] = useState(false)
  const [editingDept, setEditingDept] = useState<AdminDepartmentItem | null>(null)
  const [deptForm, setDeptForm] = useState({
    name: '',
    open_time: '09:00',
    close_time: '17:00',
    slot_minutes: 30,
    max_per_slot: 6,
  })
  const [savingDept, setSavingDept] = useState(false)

  // Service Modal
  const [serviceModalOpen, setServiceModalOpen] = useState(false)
  const [editingService, setEditingService] = useState<AdminServiceItem | null>(null)
  const [serviceForm, setServiceForm] = useState({
    department_id: '',
    name: '',
    prefix: 'A',
    avg_duration: 10,
    priority_level: 0,
    active: true,
  })
  const [savingService, setSavingService] = useState(false)

  // User Role Modal
  const [userModalOpen, setUserModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<AdminUserItem | null>(null)
  const [userForm, setUserForm] = useState({
    role: 'customer' as 'customer' | 'staff' | 'manager' | 'admin',
    account_status: 'active',
  })
  const [savingUser, setSavingUser] = useState(false)

  // Rules Modal
  const [rulesModalOpen, setRulesModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<AdminRuleItem | null>(null)
  const [rulesForm, setRulesForm] = useState({
    max_appts_per_user_day: 2,
    max_active_tokens: 1,
    cancel_limit: 3,
    late_checkin_minutes: 10,
    early_checkin_minutes: 10,
  })
  const [savingRules, setSavingRules] = useState(false)

  // ── Maintenance Trigger ──────────────────────────────────────
  const handleRunMaintenance = async () => {
    setRunningMaintenance(true)
    try {
      const res = await triggerSystemMaintenance()
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(
          `Maintenance complete! ${res.remindersSent} reminder(s) sent, ${res.missedCleaned} missed appointment(s) updated.`
        )
      }
    } finally {
      setRunningMaintenance(false)
    }
  }

  // ── Department CRUD ──────────────────────────────────────────
  const handleOpenCreateDept = () => {
    setEditingDept(null)
    setDeptForm({
      name: '',
      open_time: '09:00',
      close_time: '17:00',
      slot_minutes: 30,
      max_per_slot: 6,
    })
    setDeptModalOpen(true)
  }

  const handleOpenEditDept = (d: AdminDepartmentItem) => {
    setEditingDept(d)
    setDeptForm({
      name: d.name,
      open_time: d.open_time,
      close_time: d.close_time,
      slot_minutes: d.slot_minutes,
      max_per_slot: d.max_per_slot,
    })
    setDeptModalOpen(true)
  }

  const handleSaveDept = async () => {
    if (!deptForm.name.trim()) {
      toast.error('Department name is required')
      return
    }
    setSavingDept(true)
    try {
      if (editingDept) {
        const res = await updateDepartment(
          editingDept.id,
          deptForm.name,
          deptForm.open_time,
          deptForm.close_time,
          Number(deptForm.slot_minutes),
          Number(deptForm.max_per_slot)
        )
        if (res.success) {
          toast.success(`Department ${deptForm.name} updated`)
          setData((prev) => ({
            ...prev,
            departments: prev.departments.map((d) =>
              d.id === editingDept.id ? { ...d, ...deptForm } : d
            ),
          }))
          setDeptModalOpen(false)
        } else {
          toast.error(res.error || 'Failed to update department')
        }
      } else {
        const res = await createDepartment(
          deptForm.name,
          deptForm.open_time,
          deptForm.close_time,
          Number(deptForm.slot_minutes),
          Number(deptForm.max_per_slot)
        )
        if (res.success) {
          toast.success(`Department ${deptForm.name} created`)
          setDeptModalOpen(false)
          window.location.reload()
        } else {
          toast.error(res.error || 'Failed to create department')
        }
      }
    } finally {
      setSavingDept(false)
    }
  }

  const handleDeleteDept = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete department "${name}"? This will delete all its services and counters.`)) {
      return
    }
    try {
      const res = await deleteDepartment(id)
      if (res.success) {
        toast.success(`Department "${name}" deleted`)
        setData((prev) => ({
          ...prev,
          departments: prev.departments.filter((d) => d.id !== id),
          services: prev.services.filter((s) => s.department_id !== id),
          rules: prev.rules.filter((r) => r.department_id !== id),
        }))
      } else {
        toast.error(res.error || 'Failed to delete department')
      }
    } catch {
      toast.error('An error occurred while deleting department')
    }
  }

  // ── Service CRUD ─────────────────────────────────────────────
  const handleOpenCreateService = () => {
    setEditingService(null)
    setServiceForm({
      department_id: data.departments[0]?.id || '',
      name: '',
      prefix: 'A',
      avg_duration: 10,
      priority_level: 0,
      active: true,
    })
    setServiceModalOpen(true)
  }

  const handleOpenEditService = (s: AdminServiceItem) => {
    setEditingService(s)
    setServiceForm({
      department_id: s.department_id,
      name: s.name,
      prefix: s.prefix,
      avg_duration: s.avg_duration,
      priority_level: s.priority_level,
      active: s.active,
    })
    setServiceModalOpen(true)
  }

  const handleSaveService = async () => {
    if (!serviceForm.name.trim()) {
      toast.error('Service name is required')
      return
    }
    setSavingService(true)
    try {
      if (editingService) {
        const res = await updateService(
          editingService.id,
          serviceForm.name,
          serviceForm.prefix,
          Number(serviceForm.avg_duration),
          Number(serviceForm.priority_level),
          serviceForm.active
        )
        if (res.success) {
          toast.success(`Service ${serviceForm.name} updated`)
          setData((prev) => ({
            ...prev,
            services: prev.services.map((s) =>
              s.id === editingService.id
                ? {
                    ...s,
                    name: serviceForm.name,
                    prefix: serviceForm.prefix,
                    avg_duration: Number(serviceForm.avg_duration),
                    priority_level: Number(serviceForm.priority_level),
                    active: serviceForm.active,
                  }
                : s
            ),
          }))
          setServiceModalOpen(false)
        } else {
          toast.error(res.error || 'Failed to update service')
        }
      } else {
        const res = await createService(
          serviceForm.department_id,
          serviceForm.name,
          serviceForm.prefix,
          Number(serviceForm.avg_duration),
          Number(serviceForm.priority_level),
          serviceForm.active
        )
        if (res.success) {
          toast.success(`Service ${serviceForm.name} created`)
          setServiceModalOpen(false)
          window.location.reload()
        } else {
          toast.error(res.error || 'Failed to create service')
        }
      }
    } finally {
      setSavingService(false)
    }
  }

  const handleDeleteService = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete service "${name}"?`)) return
    try {
      const res = await deleteService(id)
      if (res.success) {
        toast.success(`Service "${name}" deleted`)
        setData((prev) => ({
          ...prev,
          services: prev.services.filter((s) => s.id !== id),
        }))
      } else {
        toast.error(res.error || 'Failed to delete service')
      }
    } catch {
      toast.error('An error occurred while deleting service')
    }
  }

  // ── User Role & Status ───────────────────────────────────────
  const handleOpenEditUser = (u: AdminUserItem) => {
    setEditingUser(u)
    setUserForm({
      role: u.role,
      account_status: u.account_status,
    })
    setUserModalOpen(true)
  }

  const handleSaveUser = async () => {
    if (!editingUser) return
    setSavingUser(true)
    try {
      const res = await updateUserRole(editingUser.id, userForm.role, userForm.account_status)
      if (res.success) {
        toast.success(`User role updated to ${userForm.role}`)
        setData((prev) => ({
          ...prev,
          users: prev.users.map((u) =>
            u.id === editingUser.id ? { ...u, role: userForm.role, account_status: userForm.account_status } : u
          ),
        }))
        setUserModalOpen(false)
      } else {
        toast.error(res.error || 'Failed to update user')
      }
    } finally {
      setSavingUser(false)
    }
  }

  // ── Rules Management ─────────────────────────────────────────
  const handleOpenEditRules = (r: AdminRuleItem) => {
    setEditingRule(r)
    setRulesForm({
      max_appts_per_user_day: r.max_appts_per_user_day,
      max_active_tokens: r.max_active_tokens,
      cancel_limit: r.cancel_limit,
      late_checkin_minutes: r.late_checkin_minutes,
      early_checkin_minutes: r.early_checkin_minutes,
    })
    setRulesModalOpen(true)
  }

  const handleSaveRules = async () => {
    if (!editingRule) return
    setSavingRules(true)
    try {
      const res = await updateDepartmentRules(
        editingRule.department_id,
        Number(rulesForm.max_appts_per_user_day),
        Number(rulesForm.max_active_tokens),
        Number(rulesForm.cancel_limit),
        Number(rulesForm.late_checkin_minutes),
        Number(rulesForm.early_checkin_minutes)
      )
      if (res.success) {
        toast.success(`Rules for ${editingRule.department_name} updated`)
        setData((prev) => ({
          ...prev,
          rules: prev.rules.map((r) =>
            r.department_id === editingRule.department_id ? { ...r, ...rulesForm } : r
          ),
        }))
        setRulesModalOpen(false)
      } else {
        toast.error(res.error || 'Failed to update rules')
      }
    } finally {
      setSavingRules(false)
    }
  }

  // Filters
  const filteredUsers = data.users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredLogs = data.logs.filter(
    (l) =>
      l.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.actor_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.entity && l.entity.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div className="space-y-8">
      {/* ── Top Header ────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <BackButton fallbackHref="/" />
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center font-bold shadow-xs">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-red-700 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full">
                  System Administration
                </span>
                <span className="text-xs text-gray-500 font-medium">{adminEmail}</span>
              </div>
              <h1 className="text-2xl font-black text-gray-900 mt-1 tracking-tight">Admin Control Panel</h1>
              <p className="text-xs text-gray-500">
                Governance, user permissions, catalog management, operational rules & audit logs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRunMaintenance}
              disabled={runningMaintenance}
              className="inline-flex items-center gap-2 bg-[#22C55E] hover:bg-[#16A34A] text-white font-bold px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer text-xs"
              title="Run System Maintenance (Send 1h reminders & mark missed appointments)"
            >
              <RotateCw className={`w-3.5 h-3.5 ${runningMaintenance ? 'animate-spin' : ''}`} />
              <span>{runningMaintenance ? 'Running...' : 'Run Reminders & Cleanup'}</span>
            </button>
          </div>
        </div>

        {/* ── Tab Bar Navigation ──────────────────────────────────── */}
        <div className="flex items-center gap-2 border-b border-gray-100 mt-6 pt-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'departments', label: `Departments (${data.departments.length})`, icon: <Building2 className="w-4 h-4" /> },
            { id: 'users', label: `Users & Roles (${data.users.length})`, icon: <Users className="w-4 h-4" /> },
            { id: 'services', label: `Services (${data.services.length})`, icon: <Layers className="w-4 h-4" /> },
            { id: 'rules', label: `Rules & Limits (${data.rules.length})`, icon: <Sliders className="w-4 h-4" /> },
            { id: 'logs', label: `Activity Log (${data.logs.length})`, icon: <FileText className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any)
                setSearchQuery('')
              }}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-red-600 text-gray-900 bg-red-50/40 rounded-t-xl'
                  : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-200'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB 1: DEPARTMENTS ────────────────────────────────────── */}
      {activeTab === 'departments' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8 space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Departments Management</h2>
              <p className="text-xs text-gray-500">
                Create and manage organization departments, working hours, and slot intervals
              </p>
            </div>
            <button
              onClick={handleOpenCreateDept}
              className="inline-flex items-center gap-2 bg-[#22C55E] hover:bg-[#16A34A] text-white font-bold px-4 py-2 rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Department</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-[11px] font-bold tracking-wider border-y border-gray-200">
                <tr>
                  <th className="py-3 px-4">Department Name</th>
                  <th className="py-3 px-4">Working Hours</th>
                  <th className="py-3 px-4">Slot Interval</th>
                  <th className="py-3 px-4">Max / Slot</th>
                  <th className="py-3 px-4">Services</th>
                  <th className="py-3 px-4">Counters</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {data.departments.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-gray-900">{d.name}</td>
                    <td className="py-3.5 px-4 text-gray-700">
                      {d.open_time} – {d.close_time}
                    </td>
                    <td className="py-3.5 px-4 text-gray-700">{d.slot_minutes} mins</td>
                    <td className="py-3.5 px-4 text-gray-700">{d.max_per_slot} visitors</td>
                    <td className="py-3.5 px-4">
                      <span className="bg-gray-100 px-2.5 py-0.5 rounded-full text-xs font-semibold text-gray-700">
                        {d.services_count} services
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="bg-gray-100 px-2.5 py-0.5 rounded-full text-xs font-semibold text-gray-700">
                        {d.counters_count} counters
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEditDept(d)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-semibold"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteDept(d.id, d.name)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 text-xs font-semibold"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 2: USERS & ROLES ──────────────────────────────────── */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8 space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">User Role Management</h2>
              <p className="text-xs text-gray-500">
                Grant and revoke Customer, Staff, Manager, and Admin role privileges
              </p>
            </div>

            <div className="relative max-w-xs w-full">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search users by name, email or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#22C55E]"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-[11px] font-bold tracking-wider border-y border-gray-200">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4">No-Show Count</th>
                  <th className="py-3 px-4">Joined</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-gray-900">{u.name}</div>
                      <div className="text-xs text-gray-400 font-mono">{u.email}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                          u.role === 'admin'
                            ? 'bg-red-100 text-red-700'
                            : u.role === 'manager'
                            ? 'bg-purple-100 text-purple-700'
                            : u.role === 'staff'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${
                          u.account_status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${u.account_status === 'active' ? 'bg-[#22C55E]' : 'bg-rose-500'}`} />
                        {u.account_status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-700">{u.no_show_count}</td>
                    <td className="py-3.5 px-4 text-gray-400 text-xs">
                      {new Date(u.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenEditUser(u)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Change Role</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: SERVICES ───────────────────────────────────────── */}
      {activeTab === 'services' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8 space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Services Catalog</h2>
              <p className="text-xs text-gray-500">
                Define available public services, ticket prefixes, target SLAs, and priority levels
              </p>
            </div>
            <button
              onClick={handleOpenCreateService}
              className="inline-flex items-center gap-2 bg-[#22C55E] hover:bg-[#16A34A] text-white font-bold px-4 py-2 rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Service</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-[11px] font-bold tracking-wider border-y border-gray-200">
                <tr>
                  <th className="py-3 px-4">Service</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Prefix</th>
                  <th className="py-3 px-4">Target Duration</th>
                  <th className="py-3 px-4">Priority Level</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {data.services.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-gray-900">{s.name}</td>
                    <td className="py-3.5 px-4 text-gray-600">{s.department_name}</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">{s.prefix}</td>
                    <td className="py-3.5 px-4 text-gray-700">{s.avg_duration} mins</td>
                    <td className="py-3.5 px-4 text-gray-700">
                      <span className="font-semibold text-xs">P{s.priority_level}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                          s.active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${s.active ? 'bg-[#22C55E]' : 'bg-rose-500'}`} />
                        {s.active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEditService(s)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-semibold"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteService(s.id, s.name)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 text-xs font-semibold"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 4: RULES & LIMITS ─────────────────────────────────── */}
      {activeTab === 'rules' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8 space-y-6 animate-in fade-in duration-300">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Department Rules & Quota Policies</h2>
            <p className="text-xs text-gray-500">
              Configure strict business limits enforced by database RPCs (prevent overbooking & queue spam)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.rules.map((r) => (
              <div
                key={r.department_id}
                className="border border-gray-200 rounded-2xl p-5 bg-gray-50/50 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-base font-black text-gray-900">{r.department_name}</span>
                    <Sliders className="w-5 h-5 text-gray-400" />
                  </div>

                  <div className="space-y-2.5 text-xs text-gray-600">
                    <div className="flex justify-between py-1 border-b border-gray-200/60">
                      <span>Max Appointments / User / Day:</span>
                      <span className="font-bold text-gray-900">{r.max_appts_per_user_day}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-200/60">
                      <span>Max Active Tokens / User:</span>
                      <span className="font-bold text-gray-900">{r.max_active_tokens}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-200/60">
                      <span>Cancellation Limit / Month:</span>
                      <span className="font-bold text-gray-900">{r.cancel_limit}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-200/60">
                      <span>Early Check-in Window:</span>
                      <span className="font-bold text-gray-900">{r.early_checkin_minutes} mins before</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-200/60">
                      <span>Late Check-in Window:</span>
                      <span className="font-bold text-gray-900">{r.late_checkin_minutes} mins after</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleOpenEditRules(r)}
                  className="mt-5 w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 text-gray-800 text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Update Policy Limits</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 5: ACTIVITY AUDIT LOG ─────────────────────────────── */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8 space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">System Activity Audit Log</h2>
              <p className="text-xs text-gray-500">
                Chronological tamper-evident audit trail of all staff, manager, and customer actions
              </p>
            </div>

            <div className="relative max-w-xs w-full">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter logs by action or actor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#22C55E]"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-[11px] font-bold tracking-wider border-y border-gray-200">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Entity ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium text-xs">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400">
                      No logs matching search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((l) => (
                    <tr key={l.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3 px-4 text-gray-500 font-mono">
                        {new Date(l.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">
                          {l.action}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-800">{l.actor_name}</div>
                        <div className="text-[10px] text-gray-400 truncate max-w-[160px]">{l.actor_email}</div>
                      </td>
                      <td className="py-3 px-4 text-gray-600 capitalize">{l.entity || '—'}</td>
                      <td className="py-3 px-4 text-gray-400 font-mono text-[11px]">
                        {l.entity_id ? `${l.entity_id.slice(0, 8)}...` : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL: DEPARTMENT ───────────────────────────────────────── */}
      {deptModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                {editingDept ? `Edit ${editingDept.name}` : 'Create New Department'}
              </h3>
              <button
                onClick={() => setDeptModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Department Name</label>
                <input
                  type="text"
                  placeholder="e.g. Student Services"
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#22C55E]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Open Time</label>
                  <input
                    type="time"
                    value={deptForm.open_time}
                    onChange={(e) => setDeptForm({ ...deptForm, open_time: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Close Time</label>
                  <input
                    type="time"
                    value={deptForm.close_time}
                    onChange={(e) => setDeptForm({ ...deptForm, close_time: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Slot Size (Min)</label>
                  <input
                    type="number"
                    min="10"
                    max="120"
                    value={deptForm.slot_minutes}
                    onChange={(e) => setDeptForm({ ...deptForm, slot_minutes: Number(e.target.value) })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Max / Slot</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={deptForm.max_per_slot}
                    onChange={(e) => setDeptForm({ ...deptForm, max_per_slot: Number(e.target.value) })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-800"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setDeptModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingDept}
                onClick={handleSaveDept}
                className="px-5 py-2 text-xs font-bold text-white bg-[#22C55E] hover:bg-[#16A34A] rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingDept ? 'Saving...' : 'Save Department'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: SERVICE ──────────────────────────────────────────── */}
      {serviceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                {editingService ? `Edit ${editingService.name}` : 'Add New Service'}
              </h3>
              <button
                onClick={() => setServiceModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {!editingService && (
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Department</label>
                  <select
                    value={serviceForm.department_id}
                    onChange={(e) => setServiceForm({ ...serviceForm, department_id: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-800"
                  >
                    {data.departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Service Name</label>
                <input
                  type="text"
                  placeholder="e.g. Identity Card Issuance"
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-800"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Prefix</label>
                  <input
                    type="text"
                    maxLength={1}
                    value={serviceForm.prefix}
                    onChange={(e) => setServiceForm({ ...serviceForm, prefix: e.target.value.toUpperCase() })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono font-bold text-center text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Duration (Min)</label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={serviceForm.avg_duration}
                    onChange={(e) => setServiceForm({ ...serviceForm, avg_duration: Number(e.target.value) })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Priority</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={serviceForm.priority_level}
                    onChange={(e) => setServiceForm({ ...serviceForm, priority_level: Number(e.target.value) })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-800"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="svc-active-chk"
                  checked={serviceForm.active}
                  onChange={(e) => setServiceForm({ ...serviceForm, active: e.target.checked })}
                  className="w-4 h-4 text-[#22C55E] rounded-md"
                />
                <label htmlFor="svc-active-chk" className="text-sm font-bold text-gray-800 cursor-pointer">
                  Service is active and open for walk-ins/appointments
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setServiceModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingService}
                onClick={handleSaveService}
                className="px-5 py-2 text-xs font-bold text-white bg-[#22C55E] hover:bg-[#16A34A] rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingService ? 'Saving...' : 'Save Service'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: USER ROLE ────────────────────────────────────────── */}
      {userModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Change Role for {editingUser.name}</h3>
              <button
                onClick={() => setUserModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">System Role</label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value as any })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-800"
                >
                  <option value="customer">Customer (Walk-in tokens & appointments)</option>
                  <option value="staff">Staff (Counter duty & token calling)</option>
                  <option value="manager">Manager (Operations, analytics & SLA controls)</option>
                  <option value="admin">Administrator (Full governance & system access)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Account Status</label>
                <select
                  value={userForm.account_status}
                  onChange={(e) => setUserForm({ ...userForm, account_status: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-800"
                >
                  <option value="active">Active (Normal access)</option>
                  <option value="suspended">Suspended (Access blocked)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setUserModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingUser}
                onClick={handleSaveUser}
                className="px-5 py-2 text-xs font-bold text-white bg-[#22C55E] hover:bg-[#16A34A] rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingUser ? 'Saving...' : 'Update Role'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: RULES ────────────────────────────────────────────── */}
      {rulesModalOpen && editingRule && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                Rules Policy for {editingRule.department_name}
              </h3>
              <button
                onClick={() => setRulesModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">
                  Max Appointments Per User Per Day
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={rulesForm.max_appts_per_user_day}
                  onChange={(e) => setRulesForm({ ...rulesForm, max_appts_per_user_day: Number(e.target.value) })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">
                  Max Concurrently Active Tokens Per User
                </label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={rulesForm.max_active_tokens}
                  onChange={(e) => setRulesForm({ ...rulesForm, max_active_tokens: Number(e.target.value) })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">
                  Cancellation Limit Per Month
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={rulesForm.cancel_limit}
                  onChange={(e) => setRulesForm({ ...rulesForm, cancel_limit: Number(e.target.value) })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1">
                    Early Check-in (Min)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={rulesForm.early_checkin_minutes}
                    onChange={(e) => setRulesForm({ ...rulesForm, early_checkin_minutes: Number(e.target.value) })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1">
                    Late Grace Window (Min)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={rulesForm.late_checkin_minutes}
                    onChange={(e) => setRulesForm({ ...rulesForm, late_checkin_minutes: Number(e.target.value) })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-800"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setRulesModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingRules}
                onClick={handleSaveRules}
                className="px-5 py-2 text-xs font-bold text-white bg-[#22C55E] hover:bg-[#16A34A] rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingRules ? 'Saving...' : 'Save Rules'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import React, { useState, useEffect } from 'react';
import { User, Article, ArticleVariant, Movement, StockMovement, Output, OutputItem, OutputType, Location, Employee, Category, UserRole } from './types';
import { 
  Package, 
  LogOut, 
  Plus, 
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  X,
  Trash2,
  ArrowUpRight,
  ArrowDownLeft,
  History,
  LayoutGrid,
  Edit,
  Edit2,
  MapPin,
  Phone,
  Printer,
  Download,
  Calendar,
  User as UserIcon,
  FileText,
  BarChart3,
  PlusCircle,
  MinusCircle,
  UserPlus,
  Database,
  Share2,
  RefreshCw,
  Box,
  ImageOff,
  Layers,
  Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PhotoUpload } from './components/PhotoUpload';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { format, addDays, startOfDay, isAfter, isBefore, parseISO, startOfToday } from 'date-fns';
import { pt } from 'date-fns/locale';

const isHoliday = (date: Date) => {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  const fixedHolidays = [
    { d: 1, m: 1 }, { d: 25, m: 4 }, { d: 1, m: 5 }, { d: 10, m: 6 },
    { d: 15, m: 8 }, { d: 5, m: 10 }, { d: 1, m: 11 }, { d: 1, m: 12 },
    { d: 8, m: 12 }, { d: 25, m: 12 }
  ];

  if (fixedHolidays.some(h => h.d === day && h.m === month)) return true;

  if (year === 2026) {
    if (day === 3 && month === 4) return true; // Sexta-feira Santa
    if (day === 5 && month === 4) return true; // Páscoa
    if (day === 4 && month === 6) return true; // Corpo de Deus
  }
  return false;
};

type View = 'login' | 'menu' | 'articles' | 'register-user' | 'add-article' | 'edit-article' | 'forgot-pin' | 'outputs' | 'inputs' | 'history' | 'calendar' | 'position' | 'article-stock' | 'inventory-report' | 'categories' | 'category-picker' | 'users-management';

const UNDEFINED_DATE = '9999-12-31T23:59';

const formatDateForInput = (dateString: string | undefined | null) => {
  if (!dateString || dateString.includes('9999-12-31')) return '';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch (e) {
    return dateString;
  }
};

const formatFullDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return 'N/A';
  if (dateStr.includes('9999-12-31')) return 'Não definido';
  const d = new Date(dateStr);
  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${d.getDate()}, ${months[d.getMonth()]}, ${d.getFullYear()} ${days[d.getDay()]} ${d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
};

const formatDateDisplay = (date: string | Date | null | undefined) => {
  if (!date) return 'N/A';
  const dateStr = typeof date === 'string' ? date : date.toISOString();
  if (dateStr.includes('9999-12-31')) return 'Não definido';
  return new Date(dateStr).toLocaleDateString();
};

const formatTimeDisplay = (date: string | Date | null | undefined) => {
  if (!date) return 'Não definido';
  const dateStr = typeof date === 'string' ? date : date.toISOString();
  if (dateStr.includes('9999-12-31')) return 'Não definido';
  return new Date(dateStr).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
};

const formatFullDateTime = (date: string | Date | null | undefined) => {
  if (!date) return 'N/A';
  const dateStr = typeof date === 'string' ? date : date.toISOString();
  if (dateStr.includes('9999-12-31')) return 'Não definido';
  return new Date(dateStr).toLocaleString();
};

const StockTimeline = ({ article, outputs, timelineRef }: { article: Article, outputs: Output[], timelineRef?: React.RefObject<HTMLDivElement | null> }) => {
  const activeMovements = React.useMemo(() => {
    return outputs
      .filter(o => o.items?.some(i => i.article_id === article.id))
      .map(o => {
        const item = o.items?.find(i => i.article_id === article.id);
        return {
          ...o,
          quantity: item?.quantity_out || 0,
          returned: item?.quantity_in || 0
        };
      })
      .filter(o => (o.quantity - o.returned) > 0)
      .sort((a, b) => new Date(a.delivery_date || 0).getTime() - new Date(b.delivery_date || 0).getTime());
  }, [article, outputs]);

  const today = startOfToday();
  
  // Calculate range: from earliest delivery to latest collection
  const minDate = activeMovements.length > 0 
    ? new Date(Math.min(...activeMovements.map(o => new Date(o.delivery_date || today).getTime())))
    : today;
  const maxDate = activeMovements.length > 0
    ? new Date(Math.max(...activeMovements.map(o => {
        const d = new Date(o.collection_date || today);
        return d.getFullYear() === 9999 ? addDays(today, 30).getTime() : d.getTime();
      })))
    : addDays(today, 7);

  return (
    <div ref={timelineRef as any} style={{ backgroundColor: '#ffffff', border: '1px solid #f1f5f9', borderRadius: '24px', padding: '24px', marginBottom: '24px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h4 style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', fontFamily: 'Outfit, sans-serif', margin: 0 }}>Posição de Stock - Linha de Tempo</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
           <div style={{ width: '12px', height: '12px', borderRadius: '9999px', backgroundColor: '#234e7a' }}></div>
           <span style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: '#94a3b8' }}>Material no Local</span>
        </div>
      </div>
      
      {activeMovements.length === 0 ? (
        <div style={{ padding: '48px 0', textAlign: 'center' }}>
          <Clock className="mx-auto mb-2" size={32} style={{ color: '#e2e8f0' }} />
          <p style={{ fontSize: '14px', fontStyle: 'italic', color: '#94a3b8', margin: 0 }}>Sem movimentos ativos para este artigo.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', paddingBottom: '16px' }}>
          <div style={{ minWidth: '900px', padding: '0 8px' }}>
            {/* Header Dates */}
            <div style={{ position: 'relative', height: '40px', borderBottom: '1px solid #f1f5f9', marginBottom: '24px' }}>
              <div style={{ position: 'absolute', left: 0, width: '200px', height: '100%', display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', color: '#94a3b8' }}>Serviço / Cliente</span>
              </div>
              <div style={{ position: 'absolute', left: '200px', right: 0, height: '100%' }}>
                {[0, 25, 50, 75, 100].map(percent => {
                  const date = new Date(minDate.getTime() + (maxDate.getTime() - minDate.getTime()) * (percent / 100));
                  return (
                    <div 
                      key={percent} 
                      style={{ position: 'absolute', left: `${percent}%`, display: 'flex', flexDirection: 'column', alignItems: 'center', transform: 'translateX(-50%)' }}
                    >
                      <div style={{ width: '1px', height: '8px', marginBottom: '4px', backgroundColor: '#cbd5e1' }}></div>
                      <span style={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8' }}>
                        {format(date, 'dd/MM')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ position: 'relative' }}>
              {/* Vertical Grid Lines */}
              <div style={{ position: 'absolute', left: '200px', right: 0, top: 0, bottom: 0, pointerEvents: 'none' }}>
                {[0, 25, 50, 75, 100].map(percent => (
                  <div 
                    key={percent} 
                    style={{ position: 'absolute', top: 0, bottom: 0, width: '1px', left: `${percent}%`, backgroundColor: '#e2e8f0' }}
                  />
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                {activeMovements.map((o, idx) => {
                  const start = new Date(o.delivery_date || today);
                  const endRaw = new Date(o.collection_date || today);
                  const end = endRaw.getFullYear() === 9999 ? maxDate : endRaw;
                  
                  const totalRange = maxDate.getTime() - minDate.getTime();
                  const left = ((start.getTime() - minDate.getTime()) / totalRange) * 100;
                  const width = Math.max(((end.getTime() - start.getTime()) / totalRange) * 100, 2);

                  return (
                    <div key={o.id} style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '16px', alignItems: 'center', position: 'relative', zIndex: 10 }}>
                      {/* Left Side: Type / Client */}
                      <div style={{ textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '16px' }}>
                        <span style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', display: 'block', lineHeight: 1, marginBottom: '4px', color: '#6366f1' }}>{o.type}</span>
                        <span style={{ fontSize: '11px', fontWeight: '900', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{o.location_name}</span>
                      </div>
                      
                      {/* Right Side: Timeline Bar */}
                      <div style={{ position: 'relative', height: '32px', display: 'flex', alignItems: 'center' }}>
                        <div style={{ position: 'absolute', inset: 0, borderRadius: '9999px', backgroundColor: '#f8fafc', border: '1px solid #f1f5f9' }}></div>
                        <motion.div
                          initial={{ width: 0, opacity: 0 }}
                          animate={{ width: `${width}%`, opacity: 1 }}
                          transition={{ duration: 0.8, delay: idx * 0.1 }}
                          style={{ position: 'absolute', left: `${left}%`, height: '20px', borderRadius: '9999px', backgroundColor: '#234e7a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <span style={{ fontSize: '10px', fontWeight: '900', color: '#ffffff', padding: '0 8px', whiteSpace: 'nowrap' }}>
                            {o.quantity - o.returned} un.
                          </span>
                        </motion.div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [view, setView] = useState<View>('login');
  const [user, setUser] = useState<User | null>(null);
  const [systemUser, setSystemUser] = useState<User | null>(null);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [articles, setArticles] = useState<Article[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [outputs, setOutputs] = useState<Output[]>([]); // Entregas
  const [movements, setMovements] = useState<Movement[]>([]); // Recolhas
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'warning'} | null>(null);
  const [confirmModal, setConfirmModal] = useState<{message: string, onConfirm: () => void} | null>(null);

  // Forgot PIN State
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotQuestion, setForgotQuestion] = useState('');
  const [forgotAnswer, setForgotAnswer] = useState('');
  const [recoveryUser, setRecoveryUser] = useState<User | null>(null);
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3>(1);

  // Permission helper
  const can = (action: 'view' | 'create' | 'edit' | 'delete' | 'share') => {
    if (!systemUser) return false;
    const role = systemUser.role;
    if (role === 'ADMIN') return true;
    if (role === 'EDITOR') {
      return action !== 'delete';
    }
    if (role === 'VIEWER') {
      return action === 'view' || action === 'share';
    }
    return false;
  };

  // Search & Filters
  const [articleSearch, setArticleSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [categoryPickerReturnView, setCategoryPickerReturnView] = useState<View | null>(null);
  const [categoriesReturnView, setCategoriesReturnView] = useState<View | null>(null);

  // Custom Confirmation Modal State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [articleToDelete, setArticleToDelete] = useState<number | null>(null);

  // Forms
  const [newArticle, setNewArticle] = useState<Partial<Article>>({});
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [variants, setVariants] = useState<ArticleVariant[]>([]);
  const [showVariantForm, setShowVariantForm] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ArticleVariant | null>(null);
  const [newVariant, setNewVariant] = useState<Partial<ArticleVariant>>({});
  const [newUser, setNewUser] = useState<Partial<User>>({ role: 'VIEWER' });

  // User Management State
  const [users, setUsers] = useState<User[]>([]);
  const [userManagementSearch, setUserManagementSearch] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [showUserManagementForm, setShowUserManagementForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userMovementsCount, setUserMovementsCount] = useState<Record<number, boolean>>({});

  // Categories State
  const [categories, setCategories] = useState<Category[]>([]);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newCategory, setNewCategory] = useState<Partial<Category>>({ nivel: 1 });

  // Output Form State
  const [outputForm, setOutputForm] = useState<Partial<Output>>({
    type: 'ALUGUER',
    with_assembly: false,
    delivery_employee: '',
    collection_employee: '',
    items: []
  });
  const [editingOutputId, setEditingOutputId] = useState<number | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string>('');
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);

  // Return Form State
  const [selectedOutputId, setSelectedOutputId] = useState<string>('');
  const [returnItems, setReturnItems] = useState<Record<number, number>>({});
  const [returnEmployee, setReturnEmployee] = useState('');
  const [editingMovementId, setEditingMovementId] = useState<number | null>(null);
  const [editingMovementData, setEditingMovementData] = useState<{quantity: number, observations: string}>({quantity: 0, observations: ''});

  const [showOutputForm, setShowOutputForm] = useState(false);
  const [showUserSelector, setShowUserSelector] = useState(false);
  const [showInputForm, setShowInputForm] = useState(false);
  const [showStockEntryForm, setShowStockEntryForm] = useState(false);
  const [showStockExitForm, setShowStockExitForm] = useState(false);
  const [editingStockMovement, setEditingStockMovement] = useState<StockMovement | null>(null);
  const [selectedStockArticle, setSelectedStockArticle] = useState<Article | null>(null);
  const [stockForm, setStockForm] = useState({
    type: 'IN' as 'IN' | 'OUT',
    document_number: '',
    date: new Date().toISOString().split('T')[0],
    quantity: 0,
    observations: ''
  });
  const [stockFilter, setStockFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [stockStartDate, setStockStartDate] = useState('2026-01-01');
  const [outputSearch, setOutputSearch] = useState('');
  const [outputStatusFilter, setOutputStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SETTLED'>('ACTIVE');
  const [outputStartDate, setOutputStartDate] = useState('2026-01-01');
  const [outputTodayOnly, setOutputTodayOnly] = useState(false);
  const [expandedOutputs, setExpandedOutputs] = useState<Record<number, boolean>>({});
  const [inputSearch, setInputSearch] = useState('');
  const [inputStatusFilter, setInputStatusFilter] = useState<'ACTIVE' | 'COMPLETED' | 'ALL'>('ACTIVE');
  const [inputStartDate, setInputStartDate] = useState('2026-01-01');
  const [inputTodayOnly, setInputTodayOnly] = useState(false);
  const [articleEditTab, setArticleEditTab] = useState<'general' | 'variants'>('general');
  const [showArticleSearchModal, setShowArticleSearchModal] = useState(false);
  const [articleSearchQuery, setArticleSearchQuery] = useState('');
  const [historyArticleFilter, setHistoryArticleFilter] = useState('');
  
  const newArticleCategoryRef = React.useRef<HTMLInputElement>(null);
  const editArticleCategoryRef = React.useRef<HTMLInputElement>(null);
  const [historyStartDate, setHistoryStartDate] = useState('2026-01-01');
  const [calendarDate, setCalendarDate] = useState(new Date().toISOString().split('T')[0]);
  const [calendarViewDate, setCalendarViewDate] = useState(new Date());
  const [showCalendarDetail, setShowCalendarDetail] = useState(false);
  const [outputFormTab, setOutputFormTab] = useState<'info' | 'items'>('info');
  const [viewSource, setViewSource] = useState<'outputs' | 'inputs' | 'calendar' | null>(null);
  const [expandedRecolhas, setExpandedRecolhas] = useState<Record<number, boolean>>({});
  const [expandedEntregas, setExpandedEntregas] = useState<Record<number, boolean>>({});
  const [expandedAtivas, setExpandedAtivas] = useState<Record<number, boolean>>({});
  const [calendarFilter, setCalendarFilter] = useState<'ALL' | 'ENTREGAS' | 'ATIVAS' | 'EFETUADAS'>('ALL');
  const [positionArticleId, setPositionArticleId] = useState<string>('');
  const [positionSearchQuery, setPositionSearchQuery] = useState('');
  const [reportStartArticle, setReportStartArticle] = useState<Article | null>(null);
  const [reportEndArticle, setReportEndArticle] = useState<Article | null>(null);
  const [reportStartDate, setReportStartDate] = useState('2026-01-01');
  const [reportEndDate, setReportEndDate] = useState('2026-12-31');
  const [reportOrder, setReportOrder] = useState<'code' | 'description'>('code');
  const [showArticleSearchFor, setShowArticleSearchFor] = useState<'start' | 'end' | null>(null);
  const timelineRef = React.useRef<HTMLDivElement>(null);

  const articleCodeInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (view === 'users-management' || view === 'login') {
      fetchUsers();
    }
  }, [view]);

  useEffect(() => {
    if (showOutputForm) {
      setOutputFormTab('info');
    }
  }, [showOutputForm]);

  useEffect(() => {
    const isFixedView = ['outputs', 'inputs', 'articles', 'article-stock'].includes(view) && !showOutputForm && !showInputForm;
    if (isFixedView) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [view, showOutputForm, showInputForm]);

  const [dbSize, setDbSize] = useState<string>('...');

  const fetchDbSize = async () => {
    try {
      const res = await fetch('/api/stats/db-size');
      const data = await res.json();
      setDbSize(data.size || '0 B');
    } catch (e) {
      console.error('Error fetching DB size:', e);
    }
  };

  useEffect(() => {
    if (view === 'menu') {
      fetchDbSize();
    }
  }, [view]);

  // Handle browser back button
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.view) {
        setView(event.state.view);
      }
    };
    window.addEventListener('popstate', handlePopState);
    
    // Set initial state
    if (!window.history.state) {
      window.history.replaceState({ view: 'login' }, '', '');
    }
    
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Sync view changes to history
  useEffect(() => {
    if (window.history.state?.view !== view) {
      window.history.pushState({ view }, '', '');
    }
    window.scrollTo(0, 0);
  }, [view]);

  useEffect(() => {
    if (view === 'add-article' && categoryPickerReturnView === 'add-article') {
      newArticleCategoryRef.current?.focus();
      setCategoryPickerReturnView(null);
    }
    if (view === 'edit-article' && categoryPickerReturnView === 'edit-article') {
      editArticleCategoryRef.current?.focus();
      setCategoryPickerReturnView(null);
    }
  }, [view, categoryPickerReturnView]);

  const fetchStockMovements = async () => {
    try {
      const res = await fetch('/api/stock-movements');
      const data = await res.json();
      setStockMovements(data);
    } catch (e) {
      console.error('Error fetching stock movements:', e);
    }
  };

  useEffect(() => {
    if (user) {
      fetchArticles();
      fetchLocations();
      fetchEmployees();
      fetchOutputs();
      fetchMovements();
      fetchStockMovements();
      fetchCategories();
    }
  }, [user, view]);

  useEffect(() => {
    if (editingArticle) {
      fetchVariants(editingArticle.id);
    } else {
      setVariants([]);
    }
  }, [editingArticle]);

  const getCategoryDisplayName = (categoryId: number | null | undefined) => {
    if (!categoryId) return '';
    const category = categories.find(c => c.id === categoryId);
    if (!category) return '';
    if (category.nivel === 1) return category.nome;
    const parent = categories.find(c => c.id === category.parent_id);
    return parent ? `${parent.nome} ${category.nome}` : category.nome;
  };

  const getCategoryStock = (categoryId: number) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return 0;

    const directArticles = articles.filter(a => a.categoria_id === categoryId);
    let total = directArticles.reduce((acc, a) => acc + (a.total_stock || 0), 0);

    if (category.nivel === 1) {
      const subfamilies = categories.filter(c => c.parent_id === categoryId);
      subfamilies.forEach(sub => {
        const subArticles = articles.filter(a => a.categoria_id === sub.id);
        total += subArticles.reduce((acc, a) => acc + (a.total_stock || 0), 0);
      });
    }

    return total;
  };

  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchArticles = async () => {
    const res = await fetch('/api/articles');
    const data = await res.json();
    setArticles(data);
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      setUsers(data);
      
      // Set the last logged in user as system user for the login screen
      if (data.length > 0) {
        const lastUser = [...data].sort((a, b) => {
          if (!a.last_login) return 1;
          if (!b.last_login) return -1;
          return new Date(b.last_login).getTime() - new Date(a.last_login).getTime();
        })[0];
        setSystemUser(lastUser || data[0]);
      }
      
      // Check movements for each user to determine if they can be deleted
      const movementsCheck: Record<number, boolean> = {};
      // This is a bit heavy, but for a small number of users it's fine
      // In a real app we'd have a specific endpoint for this
      setUserMovementsCount({});
    } catch (e) {
      console.error('Error fetching users:', e);
    }
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';
      
      const userData = editingUser || newUser;
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.warning) {
          showToast(data.warning, 'warning');
        } else {
          showToast(editingUser ? 'Utilizador atualizado!' : 'Utilizador criado!');
        }
        setShowUserManagementForm(false);
        setEditingUser(null);
        setNewUser({});
        fetchUsers();
      } else {
        const data = await response.json();
        showToast(data.error || 'Erro ao processar utilizador', 'error');
      }
    } catch (e) {
      showToast('Erro de conexão', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id: number) => {
    setConfirmModal({
      message: 'Tem a certeza que deseja eliminar este utilizador?',
      onConfirm: async () => {
        setConfirmModal(null);
        setLoading(true);
        try {
          const response = await fetch(`/api/users/${id}`, { method: 'DELETE' });
          if (response.ok) {
            showToast('Utilizador eliminado!');
            fetchUsers();
          } else {
            const data = await response.json();
            showToast(data.error || 'Erro ao eliminar utilizador', 'error');
          }
        } catch (e) {
          showToast('Erro de conexão', 'error');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleToggleUserStatus = async (userToToggle: User) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/users/${userToToggle.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...userToToggle, active: !userToToggle.active })
      });

      if (response.ok) {
        showToast(userToToggle.active ? 'Utilizador desativado!' : 'Utilizador ativado!');
        fetchUsers();
      } else {
        const data = await response.json();
        showToast(data.error || 'Erro ao alterar estado do utilizador', 'error');
      }
    } catch (e) {
      showToast('Erro de conexão', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchVariants = async (articleId: number) => {
    try {
      const res = await fetch(`/api/articles/${articleId}/variants`);
      const data = await res.json();
      setVariants(data);
    } catch (e) {
      console.error('Error fetching variants:', e);
    }
  };

  const fetchLocations = async () => {
    const res = await fetch('/api/locations');
    const data = await res.json();
    setLocations(data);
  };

  const fetchEmployees = async () => {
    const res = await fetch('/api/employees');
    const data = await res.json();
    setEmployees(data);
  };

  const fetchOutputs = async () => {
    const res = await fetch('/api/outputs');
    const data = await res.json();
    setOutputs(data);
  };

  const fetchMovements = async () => {
    const res = await fetch('/api/movements');
    const data = await res.json();
    setMovements(data);
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      setCategories(data);
    } catch (e) {
      console.error('Error fetching categories:', e);
    }
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = editingCategory ? `/api/categories/${editingCategory.id}` : '/api/categories';
      const method = editingCategory ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingCategory || newCategory)
      });

      if (response.ok) {
        showToast(editingCategory ? 'Categoria atualizada!' : 'Categoria criada!');
        setShowCategoryForm(false);
        setEditingCategory(null);
        setNewCategory({ nivel: 1 });
        fetchCategories();
      } else {
        const data = await response.json();
        showToast(data.error || 'Erro ao processar categoria', 'error');
      }
    } catch (e) {
      showToast('Erro de conexão', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    setConfirmModal({
      message: 'Tem a certeza que deseja eliminar esta categoria?',
      onConfirm: async () => {
        setConfirmModal(null);
        setLoading(true);
        try {
          const response = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
          if (response.ok) {
            showToast('Categoria eliminada!');
            fetchCategories();
          } else {
            const data = await response.json();
            showToast(data.error || 'Erro ao eliminar categoria', 'error');
          }
        } catch (e) {
          showToast('Erro de conexão', 'error');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleStockMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStockArticle || !user) return;

    setLoading(true);
    try {
      const url = editingStockMovement 
        ? `/api/stock-movements/${editingStockMovement.id}` 
        : '/api/stock-movements';
      const method = editingStockMovement ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article_id: selectedStockArticle.id,
          user_id: user.id,
          type: stockForm.type,
          quantity: stockForm.quantity,
          date: stockForm.date,
          document_number: stockForm.document_number,
          observations: stockForm.observations
        })
      });

      if (response.ok) {
        showToast(editingStockMovement ? 'Movimento atualizado com sucesso!' : 'Movimento registado com sucesso!');
        setShowStockEntryForm(false);
        setShowStockExitForm(false);
        setEditingStockMovement(null);
        setStockForm({
          type: 'IN',
          document_number: '',
          date: new Date().toISOString().split('T')[0],
          quantity: 0,
          observations: ''
        });
        fetchArticles();
        fetchStockMovements();
      } else {
        const data = await response.json();
        showToast(data.error || 'Erro ao processar movimento', 'error');
      }
    } catch (e) {
      showToast('Erro de conexão', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStockMovement = async (id: number) => {
    setConfirmModal({
      message: 'Tem a certeza que deseja eliminar este movimento? O stock será revertido.',
      onConfirm: async () => {
        setConfirmModal(null);
        setLoading(true);
        try {
          const response = await fetch(`/api/stock-movements/${id}`, {
            method: 'DELETE'
          });

          if (response.ok) {
            showToast('Movimento eliminado com sucesso!');
            fetchArticles();
            fetchStockMovements();
          } else {
            const data = await response.json();
            showToast(data.error || 'Erro ao eliminar movimento', 'error');
          }
        } catch (e) {
          showToast('Erro de conexão', 'error');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const generateStockMovementsReport = async () => {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    
    const doc = new jsPDF('l', 'mm', 'a4');
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42); // slate-900
    
    if (view === 'history') {
      doc.text('Histórico de Entregas e Recolhas', 14, 22);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-PT')}`, 14, 30);
      doc.text(`Desde: ${formatDateDisplay(historyStartDate)}`, 14, 35);
      if (historyArticleFilter) {
        doc.text(`Filtro Artigo: ${historyArticleFilter}`, 14, 40);
      }

      const combinedHistory: any[] = [];
      outputs.forEach(o => {
        o.items?.forEach(item => {
          combinedHistory.push({
            type: 'ENTREGA',
            date: o.delivery_date || o.created_at,
            article_description: item.article_description,
            article_code: item.article_code,
            quantity: item.quantity_out,
            client_name: o.client_name,
            location_name: o.location_name,
            space_at_location: o.space_at_location,
            delivery_type: o.type,
            user_name: o.user_name,
          });
        });
      });

      movements.filter(m => m.type === 'IN' && m.observations?.includes('Recolha')).forEach(m => {
        const outputIdMatch = m.observations?.match(/#(\d+)/);
        const outputId = outputIdMatch ? parseInt(outputIdMatch[1]) : null;
        const relatedOutput = outputId ? outputs.find(o => o.id === outputId) : null;

        combinedHistory.push({
          type: 'RECOLHA',
          date: m.date,
          article_description: m.article_description,
          article_code: m.article_code,
          quantity: m.quantity,
          user_name: m.user_name,
          client_name: relatedOutput?.client_name || '',
          location_name: relatedOutput?.location_name || '',
          space_at_location: relatedOutput?.space_at_location || '',
          delivery_type: relatedOutput?.type || ''
        });
      });

      const filtered = combinedHistory
        .filter(h => {
          const date = new Date(h.date);
          const start = new Date(historyStartDate);
          const matchesDate = date >= start;
          const matchesArticle = (h.article_description?.toLowerCase() || '').includes(historyArticleFilter.toLowerCase()) ||
                               (h.article_code?.toLowerCase() || '').includes(historyArticleFilter.toLowerCase());
          return matchesDate && matchesArticle;
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const tableData = filtered.map(h => [
        formatDateDisplay(h.date),
        h.type,
        h.delivery_type || '-',
        h.article_code,
        h.article_description,
        h.quantity.toString(),
        h.client_name || '-',
        `${h.location_name || ''} ${h.space_at_location ? `(${h.space_at_location})` : ''}`.trim() || '-',
        h.user_name
      ]);

      autoTable(doc, {
        startY: 45,
        head: [['Data', 'Tipo', 'Subtipo', 'Cód.', 'Artigo', 'Qtd', 'Cliente', 'Localização', 'Utilizador']],
        body: tableData,
        headStyles: { fillColor: [15, 23, 42], textColor: 255 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { top: 45 },
      });

      doc.save(`historico-entregas-recolhas-${new Date().toISOString().split('T')[0]}.pdf`);
    } else {
      const title = selectedStockArticle 
        ? `Movimentos ${selectedStockArticle.description}` 
        : 'Movimentos Globais';
      
      doc.text(title, 14, 22);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-PT')}`, 14, 30);
      doc.text(`Filtro: ${stockFilter === 'ALL' ? 'Todos' : stockFilter === 'IN' ? 'Entradas' : 'Saídas'}`, 14, 35);
      doc.text(`Desde: ${formatDateDisplay(stockStartDate)}`, 14, 40);

      const filteredMovements = stockMovements.filter(m => {
        const matchesArticle = !selectedStockArticle || m.article_id === selectedStockArticle.id;
        const matchesType = stockFilter === 'ALL' || m.type === stockFilter;
        const matchesDate = m.date >= stockStartDate;
        return matchesArticle && matchesType && matchesDate;
      });

      const tableData = filteredMovements.map(m => [
        formatDateDisplay(m.date),
        m.article_description || '',
        m.type === 'IN' ? 'ENTRADA' : 'SAÍDA',
        m.quantity.toString(),
        m.document_number || '-',
        m.observations || '-'
      ]);

      autoTable(doc, {
        startY: 45,
        head: [['Data', 'Artigo', 'Tipo', 'Qtd', 'Doc/Fatura', 'Observações']],
        body: tableData,
        headStyles: { fillColor: [15, 23, 42], textColor: 255 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { top: 45 },
      });

      const fileName = selectedStockArticle 
        ? `movimentos-${selectedStockArticle.code}-${new Date().toISOString().split('T')[0]}.pdf`
        : `movimentos-globais-${new Date().toISOString().split('T')[0]}.pdf`;

      doc.save(fileName);
    }
  };

  const initializeReportArticles = (order: 'code' | 'description') => {
    if (articles.length === 0) return;
    
    const sorted = [...articles].sort((a, b) => {
      if (order === 'code') {
        return a.code.localeCompare(b.code);
      } else {
        return a.description.localeCompare(b.description);
      }
    });
    
    setReportStartArticle(sorted[0]);
    setReportEndArticle(sorted[sorted.length - 1]);
  };

  const generateInventoryReportPDF = async () => {
    if (!reportStartArticle || !reportEndArticle) {
      showToast('Selecione o artigo inicial e final', 'error');
      return;
    }

    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;
    const margin = 14;
    
    // Filter articles in range based on selected order
    const filteredArticles = articles
      .filter(a => {
        if (reportOrder === 'code') {
          return a.code >= reportStartArticle.code && a.code <= reportEndArticle.code;
        } else {
          return (a.description?.toLowerCase() || '') >= (reportStartArticle.description?.toLowerCase() || '') && 
                 (a.description?.toLowerCase() || '') <= (reportEndArticle.description?.toLowerCase() || '');
        }
      })
      .sort((a, b) => {
        if (reportOrder === 'code') {
          return a.code.localeCompare(b.code);
        } else {
          return a.description.localeCompare(b.description);
        }
      });

    if (filteredArticles.length === 0) {
      showToast('Nenhum artigo encontrado no intervalo selecionado', 'error');
      return;
    }

    // --- HEADER ---
    doc.setFillColor(15, 23, 42); // slate-900 for a more technical look
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('RELATÓRIO DE INVENTÁRIO', margin, 18);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text('A2R GESTÃO DE INVENTÁRIO E LOGÍSTICA', margin, 25);
    
    // Header Info Box (Right side)
    doc.setFillColor(30, 41, 59); // slate-800
    doc.roundedRect(pageWidth - 85, 8, 75, 24, 2, 2, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('DATA DE EMISSÃO:', pageWidth - 80, 14);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date().toLocaleString('pt-PT'), pageWidth - 80, 18);
    
    doc.setFont('helvetica', 'bold');
    doc.text('PERÍODO DO RELATÓRIO:', pageWidth - 80, 24);
    doc.setFont('helvetica', 'normal');
    doc.text(`${formatDateDisplay(reportStartDate)} a ${formatDateDisplay(reportEndDate)}`, pageWidth - 80, 28);

    let currentY = 50;

    // --- DETAILED MOVEMENTS ---
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text('DETALHE DE MOVIMENTOS POR ARTIGO', margin, currentY);
    currentY += 10;

    for (const article of filteredArticles) {
      const movementsBefore = stockMovements.filter(m => m.article_id === article.id && m.date < reportStartDate);
      const initialStock = movementsBefore.reduce((acc, m) => acc + (m.type === 'IN' ? m.quantity : -m.quantity), 0);

      const movementsInPeriod = stockMovements
        .filter(m => m.article_id === article.id && m.date >= reportStartDate && m.date <= reportEndDate + 'T23:59:59')
        .sort((a, b) => a.date.localeCompare(b.date));

      const finalStock = initialStock + movementsInPeriod.reduce((acc, m) => acc + (m.type === 'IN' ? m.quantity : -m.quantity), 0);

      // Check for page break before article header
      if (currentY > 240) {
        doc.addPage();
        currentY = 20;
      }

      // Article Header Card
      const hasMovements = movementsInPeriod.length > 0;
      const cardHeight = hasMovements ? 9 : 14; 
      
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.roundedRect(margin, currentY, pageWidth - (margin * 2), cardHeight, 1, 1, 'FD');
      
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      const categoryText = article.categoria_id ? ` [${getCategoryDisplayName(article.categoria_id)}]` : '';
      doc.text(`${article.code} - ${article.description}${categoryText}`, margin + 4, currentY + 6);
      
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);

      if (hasMovements) {
        doc.setFont('helvetica', 'normal');
        // Stock em [Data de Início] on the same line as description (right-aligned)
        doc.text(`Stock em ${formatDateDisplay(reportStartDate)}: ${initialStock}`, pageWidth - margin - 4, currentY + 6, { align: 'right' });
        currentY += cardHeight + 4;
      } else {
        doc.setFont('helvetica', 'italic');
        doc.text('Sem movimentos registados no período selecionado.', pageWidth - margin - 4, currentY + 6, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.text(`Stock em ${formatDateDisplay(reportEndDate)}: ${finalStock}`, pageWidth - margin - 4, currentY + 11, { align: 'right' });
        currentY += cardHeight + 4;
      }

      if (hasMovements) {
        let runningStock = initialStock;
        const tableRows = movementsInPeriod.map(m => {
          runningStock += (m.type === 'IN' ? m.quantity : -m.quantity);
          return [
            formatDateDisplay(m.date),
            m.type === 'IN' ? 'ENTRADA' : 'SAÍDA',
            m.quantity.toString(),
            m.document_number || '-',
            m.observations || '-',
            runningStock.toString()
          ];
        });

        autoTable(doc, {
          startY: currentY - 2,
          head: [['Data', 'Operação', 'Qtd', 'Documento', 'Observações', 'Stock']],
          body: tableRows,
          theme: 'grid',
          headStyles: { fillColor: [71, 85, 105], textColor: 255, fontSize: 7, halign: 'center' },
          columnStyles: {
            0: { cellWidth: 25, halign: 'center' },
            1: { cellWidth: 20, halign: 'center' },
            2: { cellWidth: 15, halign: 'center' },
            3: { cellWidth: 35 },
            4: { cellWidth: 'auto' },
            5: { cellWidth: 15, halign: 'center', fontStyle: 'bold' }
          },
          styles: { fontSize: 7, cellPadding: 1.5 },
          margin: { left: margin + 4, right: margin + 4 },
          didDrawPage: (data) => { currentY = data.cursor ? data.cursor.y : currentY; }
        });
        currentY += 10;
      }
    }

    // --- FOOTER & SIGNATURE ---
    if (currentY > 240) {
      doc.addPage();
      currentY = 20;
    }
    
    currentY += 20;
    doc.setDrawColor(203, 213, 225);
    doc.line(margin + 20, currentY, margin + 80, currentY);
    doc.line(pageWidth - margin - 80, currentY, pageWidth - margin - 20, currentY);
    
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Responsável de Armazém', margin + 50, currentY + 5, { align: 'center' });
    doc.text('Verificação / Auditoria', pageWidth - margin - 50, currentY + 5, { align: 'center' });

    // Page Numbers
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(`A2R Inventory System - Relatório de Inventário - Página ${i} de ${totalPages}`, pageWidth / 2, 290, { align: 'center' });
    }

    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
    doc.save(`relatorio-inventario-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const generateCategoriesReportPDF = async () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;
    const margin = 14;
    
    const search = categorySearch.toLowerCase();
    const filteredFamilies = categories
      .filter(c => c.nivel === 1)
      .filter(family => {
        if (!search) return true;
        const familyMatch = family.nome.toLowerCase().includes(search) || family.codigo.toLowerCase().includes(search);
        const subfamilies = categories.filter(c => c.parent_id === family.id);
        const subMatch = subfamilies.some(sub => sub.nome.toLowerCase().includes(search) || sub.codigo.toLowerCase().includes(search));
        return familyMatch || subMatch;
      });

    // --- HEADER ---
    doc.setFillColor(15, 23, 42); 
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('RELATÓRIO DE FAMÍLIAS', margin, 18);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184); 
    doc.text('A2R GESTÃO DE INVENTÁRIO E LOGÍSTICA', margin, 25);
    
    doc.setFillColor(30, 41, 59); 
    doc.roundedRect(pageWidth - 85, 8, 75, 24, 2, 2, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('DATA DE EMISSÃO:', pageWidth - 80, 14);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date().toLocaleString('pt-PT'), pageWidth - 80, 18);
    
    if (search) {
      doc.setFont('helvetica', 'bold');
      doc.text('FILTRO:', pageWidth - 80, 24);
      doc.setFont('helvetica', 'normal');
      doc.text(categorySearch, pageWidth - 80, 28);
    }

    let currentY = 50;

    const tableData: any[] = [];
    filteredFamilies.forEach(family => {
      // Add Family Row
      tableData.push([
        { content: family.codigo, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
        { content: family.nome, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
        { content: 'Família Principal', styles: { fontStyle: 'italic', fillColor: [241, 245, 249] } },
        { content: `${getCategoryStock(family.id)} un.`, styles: { fontStyle: 'bold', halign: 'right', fillColor: [241, 245, 249] } }
      ]);

      const subfamilies = categories
        .filter(c => c.parent_id === family.id)
        .filter(sub => {
          if (!search) return true;
          const familyMatch = family.nome.toLowerCase().includes(search) || family.codigo.toLowerCase().includes(search);
          const subMatch = sub.nome.toLowerCase().includes(search) || sub.codigo.toLowerCase().includes(search);
          return familyMatch || subMatch;
        });

      subfamilies.forEach(sub => {
        tableData.push([
          `  ${sub.codigo}`,
          `  ${sub.nome}`,
          'Subfamília',
          { content: `${getCategoryStock(sub.id)} un.`, styles: { halign: 'right' } }
        ]);
      });
    });

    autoTable(doc, {
      startY: currentY,
      head: [['Código', 'Nome / Descrição', 'Nível', 'Stock Total']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [71, 85, 105], textColor: 255, fontSize: 9, halign: 'center' },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 40, halign: 'center' },
        3: { cellWidth: 30, halign: 'right' }
      },
      margin: { left: margin, right: margin }
    });

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(`A2R Inventory System - Relatório de Famílias - Página ${i} de ${totalPages}`, pageWidth / 2, 290, { align: 'center' });
    }

    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
  };

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    if (pin.length !== 4) return;
    
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          pin, 
          email: systemUser?.email 
        })
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        setView('menu');
      } else {
        setError('PIN incorreto');
        setPin('');
      }
    } catch (err) {
      setError('Erro ao conectar ao servidor');
    }
  };

  const handleRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = isEditingUser ? `/api/users/${newUser.id}` : '/api/users';
      const method = isEditingUser ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      if (res.ok) {
        setView('login');
        setNewUser({ role: 'VIEWER' });
        setIsEditingUser(false);
        setRecoveryUser(null);
        showToast(isEditingUser ? 'Utilizador atualizado com sucesso!' : 'Utilizador registado com sucesso!');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newArticle.categoria_id) {
      showToast('Por favor selecione uma Família / Subfamília válida', 'error');
      newArticleCategoryRef.current?.focus();
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newArticle,
          total_stock: 0, // Ensure it's always 0 on creation
          available_stock: 0
        })
      });
      if (res.ok) {
        await fetchArticles();
        setView('articles');
        setNewArticle({});
      }
    } finally {
      setLoading(false);
    }
  };

  const openAddArticle = () => {
    const maxCode = articles.reduce((max, art) => {
      const codeNum = parseInt(art.code);
      return !isNaN(codeNum) ? Math.max(max, codeNum) : max;
    }, 0);
    const nextCode = (maxCode + 1).toString().padStart(4, '0');
    setNewArticle({
      code: nextCode,
      total_stock: 0,
      available_stock: 0,
      description: '',
      height: 0,
      width: 0,
      length: 0,
      weight: 0
    });
    setView('add-article');
  };

  const handleEditArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingArticle) return;
    if (!editingArticle.categoria_id) {
      showToast('Por favor selecione uma Família / Subfamília válida', 'error');
      editArticleCategoryRef.current?.focus();
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/articles/${editingArticle.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingArticle)
      });
      if (res.ok) {
        await fetchArticles();
        setView('articles');
        setEditingArticle(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingArticle || !newVariant.name) return;

    setLoading(true);
    try {
      const res = await fetch('/api/article-variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newVariant,
          article_id: editingArticle.id,
          description: newVariant.description || editingArticle.description
        })
      });

      if (res.ok) {
        showToast('Modelo adicionado com sucesso!');
        fetchVariants(editingArticle.id);
        setShowVariantForm(false);
        setNewVariant({});
      } else {
        showToast('Erro ao adicionar modelo', 'error');
      }
    } catch (err) {
      showToast('Erro ao conectar ao servidor', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVariant || !editingArticle) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/article-variants/${editingVariant.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingVariant)
      });

      if (res.ok) {
        showToast('Modelo atualizado com sucesso!');
        fetchVariants(editingArticle.id);
        setEditingVariant(null);
      } else {
        showToast('Erro ao atualizar modelo', 'error');
      }
    } catch (err) {
      showToast('Erro ao conectar ao servidor', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVariant = async (id: number) => {
    setConfirmModal({
      message: 'Tem a certeza que deseja eliminar este modelo? Esta ação não pode ser desfeita.',
      onConfirm: async () => {
        setConfirmModal(null);
        if (!editingArticle) return;

        try {
          const res = await fetch(`/api/article-variants/${id}`, {
            method: 'DELETE'
          });

          if (res.ok) {
            showToast('Modelo eliminado com sucesso!');
            fetchVariants(editingArticle.id);
          } else {
            showToast('Erro ao eliminar modelo', 'error');
          }
        } catch (err) {
          showToast('Erro ao conectar ao servidor', 'error');
        }
      }
    });
  };

  const confirmDeleteArticle = (id: number) => {
    if (!id) {
      showToast('Erro: ID do artigo não encontrado.', 'error');
      return;
    }
    setArticleToDelete(id);
    setShowDeleteConfirm(true);
  };

  const executeDeleteArticle = async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/articles/${id}`, { 
        method: 'DELETE'
      });
      
      if (res.ok) {
        showToast('Artigo eliminado com sucesso!');
        setEditingArticle(null);
        setView('articles');
        await fetchArticles();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Erro ao eliminar artigo', 'error');
      }
    } catch (err) {
      console.error('Delete error:', err);
      showToast('Erro de ligação ao servidor.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleShareArticle = async (article: Article) => {
    try {
      showToast('A preparar imagem para partilha...', 'success');
      
      // Create a canvas to combine image and text
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      // Load the article image
      const loadImage = (src: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });
      };

      let articleImg: HTMLImageElement | null = null;
      if (article.photo) {
        try {
          articleImg = await loadImage(article.photo);
        } catch (e) {
          console.error("Error loading article image", e);
        }
      }

      // Canvas dimensions
      const width = 800;
      const padding = 40;
      let currentY = padding;

      // Calculate height
      let totalHeight = padding * 2;
      
      // Branding height
      totalHeight += 70;

      // Image height (maintain aspect ratio)
      let imgDisplayHeight = 0;
      if (articleImg) {
        const aspectRatio = articleImg.height / articleImg.width;
        imgDisplayHeight = (width - padding * 2) * aspectRatio;
        totalHeight += imgDisplayHeight + 30; // 30 is gap after image
      }

      // Text heights
      totalHeight += 60; // Description
      
      const fields = [
        { label: 'Altura', value: article.height, unit: 'cm' },
        { label: 'Comprimento', value: article.length, unit: 'cm' },
        { label: 'Largura', value: article.width, unit: 'cm' },
        { label: 'Peso', value: article.weight, unit: 'Kg' }
      ].filter(f => f.value && f.value > 0);

      totalHeight += fields.length * 35;

      canvas.width = width;
      canvas.height = totalHeight;

      // Draw background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw Branding Header (Discrete)
      ctx.textAlign = 'right';
      ctx.fillStyle = '#0f172a'; // Dark slate
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('A2R ALL2RENT', width - padding, currentY + 20);
      
      ctx.fillStyle = '#94a3b8'; // Muted slate
      ctx.font = '14px sans-serif';
      ctx.fillText('Aluguer de tudo para eventos', width - padding, currentY + 40);
      
      // Small separator line
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding, currentY + 55);
      ctx.lineTo(width - padding, currentY + 55);
      ctx.stroke();

      currentY += 80;

      // Draw image first
      if (articleImg) {
        ctx.drawImage(articleImg, padding, currentY, width - padding * 2, imgDisplayHeight);
        currentY += imgDisplayHeight + 40;
      } else {
        // Placeholder if no image
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(padding, currentY, width - padding * 2, 400);
        ctx.fillStyle = '#cbd5e1';
        ctx.font = 'italic 30px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Sem imagem disponível', width / 2, currentY + 200);
        currentY += 400 + 40;
      }

      // Draw Description
      ctx.textAlign = 'left';
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 36px sans-serif';
      ctx.fillText(article.description.toUpperCase(), padding, currentY);
      currentY += 50;

      // Draw Info Fields
      ctx.font = '30px sans-serif';
      ctx.fillStyle = '#64748b';
      
      fields.forEach(field => {
        ctx.font = 'bold 30px sans-serif';
        ctx.fillStyle = '#475569';
        const labelText = `${field.label}: `;
        const labelWidth = ctx.measureText(labelText).width;
        ctx.fillText(labelText, padding, currentY);
        
        ctx.font = '30px sans-serif';
        ctx.fillStyle = '#1e293b';
        ctx.fillText(`${field.value} ${field.unit}`, padding + labelWidth, currentY);
        
        currentY += 40;
      });

      // Convert to blob
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png', 1.0));
      if (!blob) throw new Error('Could not generate image blob');

      const file = new File([blob], `artigo_${article.code}.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Artigo: ${article.description}`,
        });
      } else {
        // Fallback: Download image
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `artigo_${article.code}.png`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Partilha não suportada. Imagem descarregada.', 'success');
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Error sharing:', err);
        showToast('Erro ao partilhar imagem do artigo', 'error');
      }
    }
  };

  const handleShareVariant = async (variant: ArticleVariant, article: Article) => {
    try {
      showToast('A preparar imagem para partilha...', 'success');
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      const loadImage = (src: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });
      };

      let variantImg: HTMLImageElement | null = null;
      if (variant.photo) {
        try {
          variantImg = await loadImage(variant.photo);
        } catch (e) {
          console.error("Error loading variant image", e);
        }
      }

      const width = 800;
      const padding = 40;
      let currentY = padding;
      let totalHeight = padding * 2 + 70; // Branding

      let imgDisplayHeight = 0;
      if (variantImg) {
        const aspectRatio = variantImg.height / variantImg.width;
        imgDisplayHeight = (width - padding * 2) * aspectRatio;
        totalHeight += imgDisplayHeight + 30;
      }

      totalHeight += 100; // Description + Variant Name
      
      const fields = [
        { label: 'Altura', value: variant.height, unit: 'cm' },
        { label: 'Comprimento', value: variant.length, unit: 'cm' },
        { label: 'Largura', value: variant.width, unit: 'cm' },
        { label: 'Peso', value: variant.weight, unit: 'Kg' }
      ].filter(f => f.value);

      totalHeight += fields.length * 35;

      canvas.width = width;
      canvas.height = totalHeight;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('A2R ALL2RENT', width - padding, currentY + 20);
      
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px sans-serif';
      ctx.fillText('Aluguer de tudo para eventos', width - padding, currentY + 40);
      
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding, currentY + 55);
      ctx.lineTo(width - padding, currentY + 55);
      ctx.stroke();

      currentY += 80;

      if (variantImg) {
        ctx.drawImage(variantImg, padding, currentY, width - padding * 2, imgDisplayHeight);
        currentY += imgDisplayHeight + 40;
      } else {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(padding, currentY, width - padding * 2, 400);
        ctx.fillStyle = '#cbd5e1';
        ctx.font = 'italic 30px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Sem imagem disponível', width / 2, currentY + 200);
        currentY += 400 + 40;
      }

      ctx.textAlign = 'left';
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 36px sans-serif';
      ctx.fillText(`${article.description}`.toUpperCase(), padding, currentY);
      currentY += 45;
      
      ctx.font = 'bold 30px sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText(variant.name.toUpperCase(), padding, currentY);
      currentY += 45;

      fields.forEach(field => {
        ctx.font = 'bold 30px sans-serif';
        ctx.fillStyle = '#64748b';
        const labelText = `${field.label}: `;
        const labelWidth = ctx.measureText(labelText).width;
        ctx.fillText(labelText, padding, currentY);
        
        ctx.font = '30px sans-serif';
        ctx.fillStyle = '#1e293b';
        ctx.fillText(`${field.value} ${field.unit}`, padding + labelWidth, currentY);
        currentY += 40;
      });

      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png', 1.0));
      if (!blob) throw new Error('Could not generate image blob');

      const file = new File([blob], `modelo_${article.code}_${variant.name}.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Modelo: ${variant.name} (${article.code})`,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `modelo_${article.code}_${variant.name}.png`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Partilha não suportada. Imagem descarregada.', 'success');
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Error sharing variant:', err);
        showToast('Erro ao partilhar imagem do modelo', 'error');
      }
    }
  };

  const addItemToOutput = () => {
    if (!selectedArticleId) return;
    const article = articles.find(a => a.id === parseInt(selectedArticleId));
    if (!article) return;

    if (article.available_stock < selectedQuantity) {
      showToast(`Stock insuficiente para ${article.description}. Disponível: ${article.available_stock}`, 'error');
      return;
    }

    const existingItemIndex = outputForm.items?.findIndex(i => i.article_id === article.id);
    
    if (existingItemIndex !== undefined && existingItemIndex > -1) {
      const newItems = [...(outputForm.items || [])];
      const newQty = newItems[existingItemIndex].quantity_out + selectedQuantity;
      
      if (article.available_stock < newQty) {
        showToast(`Stock insuficiente para ${article.description}. Disponível: ${article.available_stock}`, 'error');
        return;
      }
      
      newItems[existingItemIndex].quantity_out = newQty;
      setOutputForm({ ...outputForm, items: newItems });
    } else {
      const newItem: Partial<OutputItem> = {
        article_id: article.id,
        quantity_out: selectedQuantity,
        article_description: article.description,
        article_code: article.code
      };
      setOutputForm({ ...outputForm, items: [...(outputForm.items || []), newItem as OutputItem] });
    }
    
    setSelectedArticleId('');
    setSelectedQuantity(1);
    
    // Focus back on article code input
    setTimeout(() => {
      articleCodeInputRef.current?.focus();
    }, 100);
  };

  const removeItemFromOutput = (articleId: number) => {
    setOutputForm({
      ...outputForm,
      items: outputForm.items?.filter(i => i.article_id !== articleId)
    });
  };

  const handleSaveOutput = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOutputId && (!outputForm.items || outputForm.items.length === 0)) {
      showToast('Adicione pelo menos um artigo à entrega.', 'error');
      return;
    }

    if (!outputForm.location_name) {
      showToast('O local é obrigatório.', 'error');
      return;
    }

    setLoading(true);
    try {
      const url = editingOutputId ? `/api/outputs/${editingOutputId}` : '/api/outputs';
      const method = editingOutputId ? 'PUT' : 'POST';
      
      const finalData = {
        ...outputForm,
        delivery_date: outputForm.delivery_date || new Date().toISOString(),
        assembly_date: outputForm.assembly_date || UNDEFINED_DATE,
        collection_date: outputForm.collection_date || UNDEFINED_DATE,
        user_id: user?.id
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalData)
      });

      if (res.ok) {
        showToast(editingOutputId ? 'Entrega atualizada com sucesso!' : 'Entrega registada com sucesso!');
        await fetchArticles();
        await fetchLocations();
        await fetchOutputs();
        if (viewSource === 'calendar') {
          setView('calendar');
        }
        setShowOutputForm(false);
        setEditingOutputId(null);
        setViewSource(null);
        setOutputForm({
          type: 'ALUGUER',
          with_assembly: false,
          delivery_employee: '',
          collection_employee: '',
          items: []
        });
      } else {
        const data = await res.json();
        showToast(`Erro: ${data.error}`, 'error');
      }
    } catch (err) {
      showToast('Erro ao conectar ao servidor', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOutputEmployee = async (id: number, data: { delivery_employee?: string, collection_employee?: string }) => {
    try {
      const res = await fetch(`/api/outputs/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        showToast('Funcionário atualizado com sucesso!');
        await fetchOutputs();
        await fetchEmployees();
      } else {
        const data = await res.json();
        showToast(`Erro: ${data.error}`, 'error');
      }
    } catch (err) {
      showToast('Erro ao conectar ao servidor', 'error');
    }
  };

  const handleSaveReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingMovementId) {
      setLoading(true);
      try {
        const res = await fetch(`/api/movements/${editingMovementId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editingMovementData)
        });
        if (res.ok) {
          // Update the output's collection_employee as well
          const movement = movements.find(m => m.id === editingMovementId);
          const outputIdMatch = movement?.observations?.match(/#(\d+)/);
          const outputId = outputIdMatch ? parseInt(outputIdMatch[1]) : null;
          if (outputId) {
            await fetch(`/api/outputs/${outputId}/status`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ collection_employee: returnEmployee })
            });
          }
          
          showToast('Recolha atualizada com sucesso!');
          await fetchArticles();
          await fetchOutputs();
          await fetchMovements();
          await fetchEmployees();
          if (viewSource === 'calendar') {
            setView('calendar');
          }
          setShowInputForm(false);
          setEditingMovementId(null);
          setViewSource(null);
        } else {
          const data = await res.json();
          showToast(`Erro: ${data.error}`, 'error');
        }
      } catch (err) {
        showToast('Erro ao conectar ao servidor', 'error');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!selectedOutputId) return;
    
    const itemsToReturn = Object.entries(returnItems)
      .filter(([_, qty]) => (qty as number) > 0)
      .map(([articleId, qty]) => ({
        article_id: parseInt(articleId),
        quantity_in: qty as number
      }));

    if (itemsToReturn.length === 0) {
      showToast('Indique a quantidade a recolher para pelo menos um artigo.', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/outputs/${selectedOutputId}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: itemsToReturn,
          user_id: user?.id,
          collection_employee: returnEmployee
        })
      });

      if (res.ok) {
        showToast('Recolha registada com sucesso!');
        await fetchArticles();
        await fetchOutputs();
        await fetchMovements();
        await fetchEmployees();
        if (viewSource === 'calendar') {
          setView('calendar');
        }
        setShowInputForm(false);
        setSelectedOutputId('');
        setReturnItems({});
        setReturnEmployee('');
        setViewSource(null);
      } else {
        const data = await res.json();
        showToast(`Erro: ${data.error}`, 'error');
      }
    } catch (err) {
      showToast('Erro ao conectar ao servidor', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOutput = async (id: number) => {
    setConfirmModal({
      message: 'Tem a certeza que deseja eliminar esta entrega? O stock será revertido.',
      onConfirm: async () => {
        setLoading(true);
        try {
          const res = await fetch(`/api/outputs/${id}`, { method: 'DELETE' });
          if (res.ok) {
            showToast('Entrega eliminada com sucesso!');
            await fetchArticles();
            await fetchOutputs();
            await fetchMovements();
          } else {
            const data = await res.json();
            showToast(`Erro: ${data.error}`, 'error');
          }
        } catch (err) {
          showToast('Erro ao conectar ao servidor', 'error');
        } finally {
          setLoading(false);
          setConfirmModal(null);
        }
      }
    });
  };

  const handlePrintOutput = (output: Output) => {
    const doc = new jsPDF();
    
    // 1. Logo ALL2RENT (Styled text as placeholder)
    doc.setFontSize(24);
    doc.setTextColor(0, 51, 102); // A2R Blue
    doc.setFont('helvetica', 'bold');
    doc.text('A2R', 20, 25);
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59); // Slate 800
    doc.text('ALL2RENT', 40, 25);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.setFont('helvetica', 'normal');
    doc.text('ALUGUER DE TUDO PARA EVENTOS', 20, 30);

    // 2. Box "ORDEM DE ENTREGA"
    doc.setDrawColor(0, 51, 102);
    doc.setLineWidth(0.5);
    doc.setFillColor(248, 250, 252); // Slate 50
    doc.rect(130, 15, 60, 15, 'FD');
    doc.setFontSize(12);
    doc.setTextColor(0, 51, 102);
    doc.setFont('helvetica', 'bold');
    doc.text('ORDEM DE ENTREGA', 135, 25);

    // 3. Header Info
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    let y = 45;
    const leftMargin = 20;
    const lineHeight = 7;

    const drawLabelValue = (label: string, value: string) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, leftMargin, y);
      const labelWidth = doc.getTextWidth(label);
      doc.setFont('helvetica', 'normal');
      doc.text(value, leftMargin + labelWidth + 2, y);
      y += lineHeight;
    };

    drawLabelValue('CLIENTE : ', output.client_name);
    drawLabelValue('CONTATO : ', output.client_contact || 'N/A');
    drawLabelValue('DATA ENTREGA : ', formatFullDate(output.delivery_date));
    drawLabelValue('DATA MONTAGEM : ', formatFullDate(output.assembly_date));
    drawLabelValue('DATA RECOLHA : ', formatFullDate(output.collection_date));
    drawLabelValue('LOCAL : ', `${output.location_name} ${output.space_at_location ? `- ${output.space_at_location}` : ''}`);
    drawLabelValue('MONTAGEM : ', output.with_assembly ? 'Sim' : 'Não');
    
    if (output.observations) {
      y += 2;
      doc.setFont('helvetica', 'bold');
      doc.text('OBS : ', leftMargin, y);
      doc.setFont('helvetica', 'normal');
      const splitObs = doc.splitTextToSize(output.observations, 170);
      doc.text(splitObs, leftMargin + 15, y);
      y += (splitObs.length * 5) + 5;
    }

    // 4. Detail Table
    const tableData = output.items?.map(item => [
      item.article_description || '',
      item.quantity_out === 0 ? '' : item.quantity_out.toString(),
      item.quantity_in === 0 ? '' : item.quantity_in.toString(),
      (item.quantity_out - item.quantity_in) === 0 ? '' : (item.quantity_out - item.quantity_in).toString()
    ]) || [];

    autoTable(doc, {
      startY: y + 5,
      head: [['MATERIAL', 'ENTREGUE', 'RECOLHIDO', 'PENDENTE']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [0, 51, 102], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3, font: 'helvetica' },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 25, halign: 'center' },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 25, halign: 'center', fontStyle: 'bold' }
      },
      margin: { left: 20, right: 20 },
      didDrawPage: (data) => {
        // Footer
        const pageSize = doc.internal.pageSize;
        const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
        
        doc.setFontSize(10);
        doc.setDrawColor(203, 213, 225); // Slate 300
        
        // Signature
        doc.line(20, pageHeight - 30, 80, pageHeight - 30);
        doc.text('Assinatura do Cliente', 20, pageHeight - 25);
        
        // Date
        doc.line(130, pageHeight - 30, 190, pageHeight - 30);
        doc.text('Data', 130, pageHeight - 25);
      }
    });

    doc.save(`Ordem_Entrega_${output.id}.pdf`);
  };

  const handlePrintDailyReport = (date: string) => {
    const doc = new jsPDF();
    const dayOutputs = outputs.filter(o => o.delivery_date?.split('T')[0] === date);
    const dayActiveRecolhas = outputs.filter(o => 
      o.collection_date?.split('T')[0] === date && 
      o.items?.some(item => item.quantity_out > item.quantity_in)
    );
    const dayMovements = movements.filter(m => 
      m.type === 'IN' && 
      m.date.split('T')[0] === date &&
      (m.observations?.includes('Recolha') || m.observations?.includes('Retorno'))
    );

    // Header Styling
    doc.setFillColor(0, 51, 102);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text('DASHBOARD DIÁRIO A2R', 20, 25);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleString()}`, 140, 25);

    doc.setFontSize(12);
    doc.setTextColor(50, 50, 50);
    doc.text(`Data de Referência: ${formatDateDisplay(date)}`, 20, 50);

    let yPos = 65;

    // Summary Cards (Visual Representation)
    const drawCard = (x: number, y: number, w: number, h: number, title: string, value: string, color: [number, number, number]) => {
      doc.setDrawColor(color[0], color[1], color[2]);
      doc.setLineWidth(0.5);
      doc.roundedRect(x, y, w, h, 3, 3, 'D');
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(title.toUpperCase(), x + 5, y + 8);
      doc.setFontSize(16);
      doc.setTextColor(color[0], color[1], color[2]);
      doc.text(value, x + 5, y + 20);
    };

    drawCard(20, yPos, 55, 30, 'Entregas', dayOutputs.length.toString(), [239, 68, 68]);
    drawCard(80, yPos, 55, 30, 'Recolhas Agend.', dayActiveRecolhas.length.toString(), [16, 185, 129]);
    drawCard(140, yPos, 55, 30, 'Recolhas Efetuadas', dayMovements.length.toString(), [59, 130, 246]);

    yPos += 45;

    // Entregas Table
    if (dayOutputs.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(0, 51, 102);
      doc.text('LISTAGEM DE ENTREGAS', 20, yPos);
      autoTable(doc, {
        startY: yPos + 5,
        head: [['ID', 'Cliente', 'Local', 'Hora']],
        body: dayOutputs.map(o => [
          o.id.toString(), 
          o.client_name || '', 
          o.location_name || '', 
          formatTimeDisplay(o.delivery_date)
        ]),
        theme: 'grid',
        headStyles: { fillColor: [239, 68, 68] },
        styles: { fontSize: 8 }
      });
      yPos = (doc as any).lastAutoTable.finalY + 15;
    }

    // Recolhas Agendadas Table
    if (dayActiveRecolhas.length > 0) {
      if (yPos > 240) { doc.addPage(); yPos = 20; }
      doc.setFontSize(12);
      doc.setTextColor(0, 51, 102);
      doc.text('LISTAGEM DE RECOLHAS AGENDADAS', 20, yPos);
      autoTable(doc, {
        startY: yPos + 5,
        head: [['ID', 'Cliente', 'Local', 'Hora']],
        body: dayActiveRecolhas.map(o => [
          o.id.toString(), 
          o.client_name || '', 
          o.location_name || '', 
          formatTimeDisplay(o.collection_date)
        ]),
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129] },
        styles: { fontSize: 8 }
      });
      yPos = (doc as any).lastAutoTable.finalY + 15;
    }

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`A2R Gestão de Eventos - Página ${i} de ${pageCount}`, 105, 290, { align: 'center' });
    }

    doc.save(`A2R_Relatorio_Diario_${date}.pdf`);
  };

  const handlePrintCategoryReport = (date: string, category: 'ENTREGAS' | 'ATIVAS' | 'EFETUADAS') => {
    const doc = new jsPDF();
    let reportTitle = '';
    let reportData: any[] = [];
    let reportColor: [number, number, number] = [0, 0, 0];

    if (category === 'ENTREGAS') {
      reportTitle = 'RELATÓRIO DE ENTREGAS';
      reportColor = [239, 68, 68];
      const items = outputs.filter(o => o.delivery_date?.split('T')[0] === date);
      reportData = items.map(o => [o.id, o.client_name, o.location_name, formatTimeDisplay(o.delivery_date)]);
    } else if (category === 'ATIVAS') {
      reportTitle = 'RELATÓRIO DE RECOLHAS AGENDADAS';
      reportColor = [16, 185, 129];
      const items = outputs.filter(o => 
        o.collection_date?.split('T')[0] === date && 
        o.items?.some(item => item.quantity_out > item.quantity_in)
      );
      reportData = items.map(o => [o.id, o.client_name, o.location_name, formatTimeDisplay(o.collection_date)]);
    } else {
      reportTitle = 'RELATÓRIO DE RECOLHAS EFETUADAS';
      reportColor = [59, 130, 246];
      const dayMovements = movements.filter(m => 
        m.type === 'IN' && 
        m.date.split('T')[0] === date &&
        (m.observations?.includes('Recolha') || m.observations?.includes('Retorno'))
      );
      
      // Group by output ID for spacing
      const grouped = dayMovements.reduce((acc, m) => {
        const outputIdMatch = m.observations?.match(/#(\d+)/);
        const outputId = outputIdMatch ? outputIdMatch[1] : 'AVULSA';
        if (!acc[outputId]) acc[outputId] = [];
        acc[outputId].push(m);
        return acc;
      }, {} as Record<string, Movement[]>);

      Object.entries(grouped).forEach(([outputId, movs], index) => {
        (movs as Movement[]).forEach(m => {
          const output = outputId !== 'AVULSA' ? outputs.find(o => o.id === parseInt(outputId)) : null;
          reportData.push([
            m.id,
            output?.type || 'N/A',
            output?.client_name || 'N/A',
            output?.client_contact || '',
            output?.location_name || 'N/A',
            output?.space_at_location || '',
            m.article_description,
            m.quantity === 0 ? '' : m.quantity.toString(),
            m.date ? formatTimeDisplay(m.date) : ''
          ]);
        });
        // Add empty row for spacing between groups
        if (index < Object.entries(grouped).length - 1) {
          reportData.push(['', '', '', '', '', '', '', '', '']);
        }
      });
    }

    doc.setFontSize(18);
    doc.setTextColor(reportColor[0], reportColor[1], reportColor[2]);
    doc.text(reportTitle, 20, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Data: ${formatDateDisplay(date)}`, 20, 28);

    const head = category === 'EFETUADAS' 
      ? [['ID', 'Tipo', 'Cliente', 'Contato', 'Local', 'Espaço', 'Artigo', 'Qtd', 'Hora']]
      : [['ID', 'Cliente', 'Local', 'Hora']];

    autoTable(doc, {
      startY: 35,
      head: head,
      body: reportData,
      theme: 'grid',
      headStyles: { fillColor: reportColor },
      styles: { fontSize: 8 },
      margin: { left: 10, right: 10 }
    });

    doc.save(`A2R_Relatorio_${category}_${date}.pdf`);
  };

  const handleDeleteMovement = async (id: number) => {
    setConfirmModal({
      message: 'Tem a certeza que deseja eliminar esta recolha? O stock será revertido.',
      onConfirm: async () => {
        setLoading(true);
        try {
          const res = await fetch(`/api/movements/${id}`, { method: 'DELETE' });
          if (res.ok) {
            showToast('Recolha eliminada com sucesso!');
            await fetchArticles();
            await fetchOutputs();
            await fetchMovements();
          } else {
            const data = await res.json();
            showToast(`Erro: ${data.error}`, 'error');
          }
        } catch (err) {
          showToast('Erro ao conectar ao servidor', 'error');
        } finally {
          setLoading(false);
          setConfirmModal(null);
        }
      }
    });
  };

  const handleForgotPin = async (emailOverride?: string) => {
    const targetEmail = emailOverride || forgotEmail;
    if (!targetEmail) return;
    
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/get-recovery-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail })
      });
      if (res.ok) {
        const data = await res.json();
        setForgotQuestion(data.question);
        setForgotStep(2);
        setView('forgot-pin');
      } else {
        const data = await res.json();
        setError(data.error);
      }
    } catch (err) {
      setError('Erro ao obter pergunta de recuperação');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAnswerStep = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/verify-recovery-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, answer: forgotAnswer })
      });
      if (res.ok) {
        const data = await res.json();
        setRecoveryUser(data.user);
        setNewUser(data.user);
        setIsEditingUser(true);
        setView('register-user');
        setForgotStep(1);
        setForgotAnswer('');
      } else {
        const data = await res.json();
        setError(data.error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleContactSupport = () => {
    const adminEmail = 'rmsp.mobile.apps@gmail.com';
    const subject = encodeURIComponent('Recuperação de PIN - A2R Inventory');
    const body = encodeURIComponent(`Olá,\n\nSolicito assistência para recuperar o meu PIN.\n\nUtilizador: ${systemUser?.name || 'Não identificado'}\nEmail: ${forgotEmail || systemUser?.email || ''}\n\nObrigado.`);
    window.location.href = `mailto:${adminEmail}?subject=${subject}&body=${body}`;
  };

  const handleMailtoOutput = (output: Output) => {
    const subject = encodeURIComponent(`Ordem de Entrega #${output.id} - ${output.client_name}`);
    let bodyText = `ORDEM DE ENTREGA #${output.id}\n\n`;
    bodyText += `Cliente: ${output.client_name}\n`;
    bodyText += `Contato: ${output.client_contact || 'N/A'}\n`;
    bodyText += `Local: ${output.location_name}\n`;
    bodyText += `Data Entrega: ${formatFullDate(output.delivery_date)}\n`;
    bodyText += `Data Recolha: ${formatFullDate(output.collection_date)}\n\n`;
    bodyText += `ARTIGOS:\n`;
    output.items?.forEach(item => {
      bodyText += `- ${item.article_description} (${item.article_code}): ${item.quantity_out} unid.\n`;
    });
    
    const body = encodeURIComponent(bodyText);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };



  const generateStockReport = async (article: Article, pendingDeliveries: number, totalStock: number, articleMovements: any[]) => {
    const doc = new jsPDF();
    const today = new Date();
    
    setLoading(true);
    
    try {
      // Header Styling (matching Dashboard)
      doc.setFillColor(0, 51, 102);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.text('DASHBOARD DE STOCK A2R', 20, 25);
      doc.setFontSize(10);
      doc.text(`Gerado em: ${new Date().toLocaleString()}`, 140, 25);

      doc.setFontSize(12);
      doc.setTextColor(50, 50, 50);
      doc.text(`Artigo: ${article.description} (${article.code})`, 20, 50);

      let yPos = 65;

      // Summary Cards
      const drawCard = (x: number, y: number, w: number, h: number, title: string, value: string, color: [number, number, number]) => {
        doc.setDrawColor(color[0], color[1], color[2]);
        doc.setLineWidth(0.5);
        doc.roundedRect(x, y, w, h, 3, 3, 'D');
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(title.toUpperCase(), x + 5, y + 8);
        doc.setFontSize(16);
        doc.setTextColor(color[0], color[1], color[2]);
        doc.text(value, x + 5, y + 20);
      };

      drawCard(20, yPos, 55, 30, 'Stock Atual', article.available_stock.toString(), [35, 78, 122]);
      drawCard(80, yPos, 55, 30, 'Entregas Pend.', pendingDeliveries.toString(), [79, 70, 229]);
      drawCard(140, yPos, 55, 30, 'Stock Total', totalStock.toString(), [30, 64, 175]);

      yPos += 45;
      
      // Movements Table
      if (articleMovements.length > 0) {
        doc.setFontSize(12);
        doc.setTextColor(0, 51, 102);
        doc.text('MOVIMENTOS ATIVOS', 20, yPos);
        
        const tableData = articleMovements.map(m => [
          m.type,
          `${m.client_name}${m.client_contact ? ` (${m.client_contact})` : ''}\n${m.location}`,
          m.quantity - m.returned,
          formatDateDisplay(m.delivery_date),
          formatDateDisplay(m.collection_date)
        ]);
        
        autoTable(doc, {
          startY: yPos + 5,
          head: [['Tipo', 'Cliente / Localização', 'Qtd. Pendente', 'Data Entrega', 'Data Recolha']],
          body: tableData,
          theme: 'grid',
          headStyles: { fillColor: [35, 78, 122] },
          styles: { fontSize: 8 }
        });
      }
      
      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`A2R Gestão de Eventos - Página ${i} de ${pageCount}`, 105, 290, { align: 'center' });
      }

      doc.save(`A2R_Dashboard_Stock_${article.code}_${format(today, 'yyyyMMdd')}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      setToast({ message: 'Erro ao gerar PDF', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const Logo = () => (
    <div className="flex flex-col items-center mb-8">
      <div className="flex items-baseline gap-1">
        <span className="text-5xl font-bold a2r-text-gradient font-display">A2R</span>
        <span className="text-2xl font-bold text-slate-900 font-display">ALL2RENT</span>
      </div>
      <span className="text-xs tracking-widest text-slate-400 uppercase font-medium mt-1">Aluguer de tudo para eventos</span>
    </div>
  );

  if (view === 'login') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 relative overflow-y-auto custom-scrollbar">
        <div className="absolute top-6 right-6">
          <button 
            onClick={() => {
              window.close();
              window.location.href = "about:blank";
            }} 
            className="p-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-all shadow-sm"
            title="Sair"
          >
            <LogOut size={20} />
          </button>
        </div>
        <Logo />
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-slate-100"
        >
          <h2 className="text-2xl font-semibold text-center mb-6 text-slate-800">Recolha no Sistema</h2>
          
          {systemUser && (
            <div className="flex flex-col items-center mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-20 h-20 rounded-full overflow-hidden mb-3 border-4 border-white shadow-md">
                {systemUser.photo ? (
                  <img src={systemUser.photo} alt={systemUser.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-a2r-blue-light/20 flex items-center justify-center text-a2r-blue-dark">
                    <UserIcon size={40} />
                  </div>
                )}
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-slate-800">Olá {systemUser.name}</p>
                <p className="text-sm text-slate-500">{systemUser.email}</p>
                <button 
                  onClick={() => setShowUserSelector(true)}
                  className="mt-2 text-xs text-a2r-blue-dark font-bold hover:underline"
                >
                  Trocar Utilizador
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-center gap-4 mb-8">
            {[0, 1, 2, 3].map((i) => (
              <div 
                key={i}
                className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                  pin.length > i ? 'bg-a2r-blue-dark border-a2r-blue-dark scale-110' : 'border-slate-300'
                }`}
              />
            ))}
          </div>
          
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => pin.length < 4 && setPin(prev => prev + num)}
                className="h-16 rounded-2xl bg-slate-50 text-2xl font-semibold text-slate-700 hover:bg-slate-100 active:scale-95 transition-all"
              >
                {num}
              </button>
            ))}
            <button 
              onClick={() => setPin('')}
              className="h-16 rounded-2xl bg-red-50 text-red-600 font-semibold hover:bg-red-100 active:scale-95 transition-all"
            >
              Limpar
            </button>
            <button
              onClick={() => pin.length < 4 && setPin(prev => prev + '0')}
              className="h-16 rounded-2xl bg-slate-50 text-2xl font-semibold text-slate-700 hover:bg-slate-100 active:scale-95 transition-all"
            >
              0
            </button>
            <button
              onClick={handleLogin}
              disabled={pin.length !== 4}
              className="h-16 rounded-2xl a2r-gradient text-white font-semibold disabled:opacity-50 active:scale-95 transition-all"
            >
              OK
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-500 text-sm justify-center mb-4">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <button 
              onClick={() => {
                setView('register-user');
                setIsEditingUser(false);
                if (systemUser) {
                  setNewUser({ email: systemUser.email });
                }
              }}
              className="text-sm text-a2r-blue-dark font-medium hover:underline text-center"
            >
              Novo Utilizador? Registar
            </button>
            <button 
              onClick={() => {
                if (systemUser) {
                  setForgotEmail(systemUser.email);
                  handleForgotPin(systemUser.email);
                }
              }}
              className={`text-xs text-slate-400 hover:underline text-center ${!systemUser ? 'opacity-0 pointer-events-none' : ''}`}
            >
              Esqueceu o PIN?
            </button>
          </div>
        </motion.div>

        {showUserSelector && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <h3 className="text-xl font-bold text-slate-800">Selecionar Utilizador</h3>
                <button onClick={() => setShowUserSelector(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>
              <div className="p-6 overflow-y-auto custom-scrollbar space-y-3">
                {users.filter(u => u.active).map(user => (
                  <button
                    key={user.id}
                    onClick={() => {
                      setSystemUser(user);
                      setShowUserSelector(false);
                      setPin('');
                      setError('');
                    }}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-all text-left"
                  >
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-sm">
                      {user.photo ? (
                        <img src={user.photo} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400">
                          <UserIcon size={24} />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{user.name}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </div>
    );
  }

  if (view === 'forgot-pin') {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center overflow-y-auto custom-scrollbar">
        <Logo />
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-slate-100"
        >
          <h2 className="text-2xl font-semibold mb-6 text-slate-800 text-center">Recuperar PIN</h2>
          
          {forgotStep === 2 && (
            <form onSubmit={handleVerifyAnswerStep} className="space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Pergunta de Segurança</label>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-slate-700 font-bold italic">
                    "{forgotQuestion}"
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sua Resposta</label>
                  <input 
                    type="text" 
                    required
                    autoFocus
                    placeholder="Escreva a sua resposta..."
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-a2r-blue-light outline-none font-medium transition-all"
                    value={forgotAnswer}
                    onChange={e => setForgotAnswer(e.target.value)}
                  />
                </div>
              </div>

              {error && <p className="text-red-500 text-xs text-center">{error}</p>}
              
              <button 
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition-all disabled:opacity-50"
              >
                {loading ? 'A verificar...' : 'Verificar Resposta'}
              </button>
              
              <button 
                type="button"
                onClick={() => setView('login')}
                className="w-full text-sm text-slate-400 hover:underline"
              >
                Voltar ao Login
              </button>
            </form>
          )}
        </motion.div>
      </div>
    );
  }

  if (view === 'register-user') {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center overflow-y-auto custom-scrollbar">
        <div className="w-full max-w-3xl bg-white rounded-[2.5rem] shadow-2xl p-10 border border-slate-100 mt-8">
          <h2 className="text-3xl font-bold mb-4 text-slate-800 font-display">
            {isEditingUser ? 'Editar Utilizador' : 'Novo Utilizador'}
          </h2>
          <form onSubmit={handleRegisterUser} className="space-y-3">
            {/* 1ª linha: Foto */}
            <div className="flex justify-center mb-2">
              <PhotoUpload 
                onPhotoCapture={base64 => setNewUser({...newUser, photo: base64})}
                currentPhoto={newUser.photo}
                label=""
              />
            </div>

            {/* 2ª linha: Nome Utilizador, Email */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Nome Utilizador</label>
                <input 
                  type="text" 
                  required
                  className="w-full px-5 py-3 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-a2r-blue-light outline-none font-medium text-lg"
                  value={newUser.name || ''}
                  onChange={e => setNewUser({...newUser, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Email</label>
                <input 
                  type="email" 
                  required
                  className="w-full px-5 py-3 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-a2r-blue-light outline-none font-medium text-lg"
                  value={newUser.email || ''}
                  onChange={e => setNewUser({...newUser, email: e.target.value})}
                />
              </div>
            </div>

            {/* 3ª Linha: PIN, Tipo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">PIN (4 DÍGITOS)</label>
                <input 
                  type="password" 
                  maxLength={4}
                  required
                  className="w-full px-5 py-3 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-a2r-blue-light outline-none font-medium text-lg"
                  value={newUser.pin || ''}
                  onChange={e => setNewUser({...newUser, pin: e.target.value.replace(/\D/g, '')})}
                />
              </div>

              {!recoveryUser && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Tipo de Utilizador</label>
                  <select 
                    className="w-full px-5 py-3 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-a2r-blue-light outline-none font-medium text-lg appearance-none bg-white"
                    value={newUser.role || 'VIEWER'}
                    onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}
                  >
                    <option value="ADMIN">Administrador</option>
                    <option value="EDITOR">Editor / Gestor</option>
                    <option value="VIEWER">Visualizador / Leitor</option>
                  </select>
                </div>
              )}
            </div>

            {/* 4ª Linha: LABEL "RECUPERAÇÃO DE CONTA" */}
            <div className="pt-2 border-t border-slate-100">
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">RECUPERAÇÃO DE CONTA</p>
            </div>

            {/* 5ª Linha: Pergunta Pessoal, Resposta */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Pergunta Pessoal</label>
                <input 
                  type="text"
                  placeholder="Ex: Nome do seu primeiro animal?"
                  className="w-full px-5 py-3 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light font-medium text-lg"
                  value={newUser.security_question || ''}
                  onChange={e => setNewUser({...newUser, security_question: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Resposta à Pergunta</label>
                <input 
                  type="text"
                  placeholder="A sua resposta secreta"
                  className="w-full px-5 py-3 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light font-medium text-lg"
                  value={newUser.security_answer || ''}
                  onChange={e => setNewUser({...newUser, security_answer: e.target.value})}
                />
              </div>
            </div>

            {/* 6ª Linha: Checkbox */}
            <div className="flex items-center gap-4 pt-1">
              <input 
                type="checkbox"
                id="reg-user-active"
                className="w-6 h-6 rounded border-slate-300 text-a2r-blue-dark focus:ring-a2r-blue-light"
                checked={newUser.active ?? true}
                onChange={e => setNewUser({...newUser, active: e.target.checked})}
              />
              <label htmlFor="reg-user-active" className="text-base font-bold text-slate-700 cursor-pointer">Utilizador Ativo</label>
            </div>

            <div className="flex gap-6 pt-6">
              <button 
                type="button"
                onClick={() => {
                  setView('login');
                  setIsEditingUser(false);
                  setNewUser({});
                }}
                className="flex-1 py-4 rounded-2xl border border-slate-200 text-slate-600 font-bold text-lg hover:bg-slate-50 transition-all"
              >
                Voltar
              </button>
              <button 
                type="submit"
                disabled={loading}
                className="flex-1 py-4 rounded-2xl a2r-gradient text-white font-bold text-lg shadow-lg shadow-blue-200 hover:opacity-90 transition-all disabled:opacity-50"
              >
                {loading ? 'A guardar...' : (isEditingUser ? 'Atualizar' : 'Registar')}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 custom-scrollbar">
      {/* Header */}
      <header className="fixed top-0 left-0 w-full bg-white border-b border-slate-200 px-6 py-4 z-50 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
              {user?.photo ? (
                <img src={user.photo} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold">
                  {user?.name?.[0]}
                </div>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Bem-vindo</p>
              <p className="text-sm font-semibold text-slate-800">{user?.name}</p>
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold a2r-text-gradient font-display">A2R</span>
          </div>
          <button 
            onClick={() => { setUser(null); setView('login'); setPin(''); }}
            className="p-2 text-slate-400 hover:text-red-500 transition-colors"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className={`max-w-5xl w-full mx-auto p-6 pt-24 pb-24 ${['outputs', 'inputs', 'articles', 'article-stock', 'history', 'calendar', 'position', 'category-picker', 'categories'].includes(view) && !showOutputForm && !showInputForm ? 'h-screen overflow-hidden flex flex-col' : ''}`}>
        <AnimatePresence mode="wait">
          {view === 'menu' && (
            <motion.div
              key="menu"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col space-y-8 pb-10"
            >
              {/* Welcome Section */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900 tracking-tight font-display">
                    Olá, <span className="a2r-text-gradient">{user?.name.split(' ')[0]}</span>!
                  </h2>
                  <div className="mt-1">
                    {user?.role === 'ADMIN' && (
                      <div>
                        <p className="text-slate-800 font-bold text-sm">Administrador</p>
                        <p className="text-slate-500 text-xs">Acesso total ao sistema</p>
                      </div>
                    )}
                    {user?.role === 'EDITOR' && (
                      <div>
                        <p className="text-slate-800 font-bold text-sm">Editor</p>
                        <p className="text-slate-500 text-xs">Pode criar e editar mas não eliminar</p>
                      </div>
                    )}
                    {user?.role === 'VIEWER' && (
                      <div>
                        <p className="text-slate-800 font-bold text-sm">Leitor</p>
                        <p className="text-slate-500 text-xs">Apenas consulta e partilha informação</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <p 
                    className="text-slate-400 font-bold text-[10px] uppercase tracking-widest cursor-pointer hover:text-a2r-blue-dark transition-colors"
                    onClick={() => {
                      if (user?.role === 'ADMIN') {
                        setView('users-management');
                      } else {
                        showToast('Apenas administradores podem aceder à gestão de utilizadores', 'error');
                      }
                    }}
                  >
                    Painel de Controlo A2R Logística
                  </p>
                  <div className="bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-widest font-display">
                      {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bento Grid Menu */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                {/* Main Actions - Larger Cards */}
                <button
                  onClick={() => setView('outputs')}
                  className="sm:col-span-2 md:col-span-2 flex flex-col justify-between p-6 md:p-8 bg-white rounded-3xl md:rounded-[2.5rem] shadow-xl shadow-blue-100/20 border border-slate-100 hover:shadow-2xl hover:-translate-y-1 transition-all group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-48 h-48 bg-blue-50 rounded-full -mr-24 -mt-24 group-hover:scale-125 transition-transform duration-700 opacity-40" />
                  <div className="relative">
                    <div className="w-14 h-14 md:w-16 md:h-16 a2r-gradient rounded-2xl flex items-center justify-center text-white mb-4 md:mb-6 shadow-lg shadow-blue-200">
                      <ArrowUpRight size={28} className="md:w-8 md:h-8" />
                    </div>
                    <h3 className="text-2xl md:text-3xl font-bold text-slate-900 mb-1 md:mb-2 font-display">Entregas</h3>
                    <p className="text-slate-500 text-xs md:text-sm max-w-[240px] font-medium">Gestão de saídas, alugueres e serviços externos.</p>
                  </div>
                  <div className="flex items-center gap-2 mt-6 md:mt-8 text-a2r-blue-dark font-bold text-xs md:text-sm uppercase tracking-widest font-display">
                    Gerir Saídas <ChevronRight size={14} className="md:w-4 md:h-4" />
                  </div>
                </button>

                <button
                  onClick={() => setView('inputs')}
                  className="flex flex-col justify-between p-6 md:p-8 bg-white rounded-3xl md:rounded-[2.5rem] shadow-xl shadow-emerald-100/20 border border-slate-100 hover:shadow-2xl hover:-translate-y-1 transition-all group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 group-hover:scale-125 transition-transform duration-700 opacity-40" />
                  <div className="relative">
                    <div className="w-14 h-14 md:w-16 md:h-16 bg-emerald-500 rounded-2xl flex items-center justify-center text-white mb-4 md:mb-6 shadow-lg shadow-emerald-200">
                      <ArrowDownLeft size={28} className="md:w-8 md:h-8" />
                    </div>
                    <h3 className="text-2xl md:text-3xl font-bold text-slate-900 mb-1 md:mb-2 font-display">Recolhas</h3>
                    <p className="text-slate-500 text-xs md:text-sm font-medium">Entrada de material e retornos de clientes.</p>
                  </div>
                  <div className="flex items-center gap-2 mt-6 md:mt-8 text-emerald-600 font-bold text-xs md:text-sm uppercase tracking-widest font-display">
                    Gerir Entradas <ChevronRight size={14} className="md:w-4 md:h-4" />
                  </div>
                </button>

                {/* Secondary Actions */}
                <button
                  onClick={() => setView('articles')}
                  className="flex flex-col items-center justify-center p-6 md:p-8 bg-white rounded-3xl md:rounded-[2.5rem] shadow-lg border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all group"
                >
                  <div className="w-14 h-14 md:w-20 md:h-20 bg-slate-50 rounded-2xl md:rounded-[2rem] flex items-center justify-center text-slate-600 mb-3 md:mb-4 group-hover:bg-a2r-blue-dark group-hover:text-white transition-all duration-300">
                    <Package size={28} className="md:w-10 md:h-10" />
                  </div>
                  <span className="text-lg md:text-xl font-bold text-slate-900 font-display">Artigos</span>
                  <span className="text-[10px] md:text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">{articles.length} Itens em Catálogo</span>
                </button>

                <button
                  onClick={() => setView('calendar')}
                  className="flex flex-col items-center justify-center p-6 md:p-8 bg-white rounded-3xl md:rounded-[2.5rem] shadow-lg border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all group"
                >
                  <div className="w-14 h-14 md:w-20 md:h-20 bg-indigo-50 rounded-2xl md:rounded-[2rem] flex items-center justify-center text-indigo-600 mb-3 md:mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                    <Calendar size={28} className="md:w-10 md:h-10" />
                  </div>
                  <span className="text-lg md:text-xl font-bold text-slate-900 font-display">Calendário</span>
                  <span className="text-[10px] md:text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Agenda de Operações</span>
                </button>

                <button
                  onClick={() => setView('position')}
                  className="flex flex-col items-center justify-center p-6 md:p-8 bg-white rounded-3xl md:rounded-[2.5rem] shadow-lg border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all group"
                >
                  <div className="w-14 h-14 md:w-20 md:h-20 bg-orange-50 rounded-2xl md:rounded-[2rem] flex items-center justify-center text-orange-600 mb-3 md:mb-4 group-hover:bg-orange-600 group-hover:text-white transition-all duration-300">
                    <MapPin size={28} className="md:w-10 md:h-10" />
                  </div>
                  <span className="text-lg md:text-xl font-bold text-slate-900 font-display">Posição</span>
                  <span className="text-[10px] md:text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Controlo de Stocks</span>
                </button>

                {/* Full Width Stats/History Link */}
                <button
                  onClick={() => { setSelectedStockArticle(null); setView('history'); }}
                  className="sm:col-span-2 md:col-span-3 flex items-center justify-between p-5 md:p-8 a2r-gradient rounded-3xl md:rounded-[2.5rem] shadow-xl hover:opacity-95 transition-all group"
                >
                  <div className="flex items-center gap-3 md:gap-6">
                    <div className="w-12 h-12 md:w-16 md:h-16 bg-white/20 rounded-xl md:rounded-2xl flex items-center justify-center text-white backdrop-blur-sm">
                      <History size={24} className="md:w-8 md:h-8" />
                    </div>
                    <div className="text-left">
                      <h4 className="text-white text-lg md:text-xl font-bold font-display">Histórico de Movimentos</h4>
                      <p className="text-white/70 text-[10px] md:text-sm font-medium">Auditoria completa de todas as entregas e recolhas.</p>
                    </div>
                  </div>
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/10 flex items-center justify-center text-white group-hover:bg-white group-hover:text-a2r-blue-dark transition-all">
                    <ChevronRight size={20} className="md:w-6 md:h-6" />
                  </div>
                </button>
              </div>

              <div className="mt-8 pt-8 border-t border-slate-100 flex justify-center">
                <div className="px-4 py-2 bg-slate-50 rounded-full flex items-center gap-3 border border-slate-100">
                  <Database size={14} className="text-slate-400" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Database Size:</span>
                  <span className="text-[10px] font-black text-slate-600">{dbSize}</span>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'articles' && (
            <motion.div
              key="articles"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col flex-1 min-h-0 space-y-6"
            >
              <div className="flex items-center justify-between shrink-0">
                <h2 className="text-2xl font-bold text-slate-800">Artigos</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setReportOrder('code');
                      initializeReportArticles('code');
                      setView('inventory-report');
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition-all shadow-sm"
                  >
                    <FileText size={18} />
                    Relatório Inventário
                  </button>
                  {can('edit') && (
                    <button 
                      onClick={() => {
                        setCategoriesReturnView('articles');
                        setView('categories');
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition-all shadow-sm"
                    >
                      <Layers size={18} />
                      Famílias
                    </button>
                  )}
                  {can('create') && (
                    <button 
                      onClick={openAddArticle}
                      className="flex items-center gap-2 px-4 py-2 a2r-gradient text-white rounded-xl font-medium shadow-lg shadow-blue-200"
                    >
                      <Plus size={18} />
                      Novo Artigo
                    </button>
                  )}
                  <button 
                    onClick={() => setView('menu')}
                    className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4 shrink-0">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Pesquisar por código, descrição ou dimensões..."
                    className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 bg-white focus:ring-2 focus:ring-a2r-blue-light outline-none"
                    value={articleSearch}
                    onFocus={() => setArticleSearch('')}
                    onChange={e => setArticleSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-1.5 custom-scrollbar">
                {articles
                  .filter(a => {
                    const search = articleSearch.toLowerCase();
                    return (a.code?.toLowerCase() || '').includes(search) || 
                           (a.description?.toLowerCase() || '').includes(search) ||
                           `${a.height}x${a.width}x${a.length}`.includes(search) ||
                           (a.weight && a.weight.toString().includes(search));
                  })
                  .map(article => (
                  <div 
                    key={article.id} 
                    onClick={() => {
                      if (can('edit')) {
                        setEditingArticle(article);
                        setView('edit-article');
                      }
                    }}
                    className="bg-white rounded-2xl p-1.5 border border-slate-100 shadow-sm hover:shadow-xl hover:border-a2r-blue-light/30 transition-all group cursor-pointer flex flex-col sm:flex-row sm:items-center gap-2 relative overflow-hidden"
                  >
                    {/* Decorative accent */}
                    <div className="absolute top-0 left-0 w-1 h-full bg-a2r-blue-dark opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    <div className="w-full sm:w-14 sm:h-14 aspect-square rounded-xl bg-slate-50 overflow-hidden relative flex-shrink-0 border border-slate-100">
                      {article.photo ? (
                        <img src={article.photo} alt={article.description} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <Package size={20} />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0 py-0.5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-800 text-base line-clamp-1 group-hover:text-a2r-blue-dark transition-colors leading-tight">{article.description}</h3>
                            <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px] font-bold text-slate-500 uppercase tracking-wider flex-shrink-0">
                              {article.code}
                            </span>
                            {article.categoria_id && (
                              <span className="px-1.5 py-0.5 bg-blue-50 rounded text-[9px] font-bold text-a2r-blue-dark uppercase tracking-wider flex-shrink-0 border border-blue-100">
                                {getCategoryDisplayName(article.categoria_id)}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                            <div className="flex items-center gap-1.5 text-slate-400">
                              <span className="text-[10px] font-medium uppercase tracking-tight">Dimensões:</span>
                              <span className="text-[10px] font-bold text-slate-600">{article.height}x{article.width}x{article.length} <span className="text-[9px] font-normal text-slate-400">cm</span></span>
                            </div>
                            {article.weight && article.weight > 0 && (
                              <div className="flex items-center gap-1.5 text-slate-400">
                                <span className="text-[10px] font-medium uppercase tracking-tight">Peso:</span>
                                <span className="text-[10px] font-bold text-slate-600">{article.weight} <span className="text-[9px] font-normal text-slate-400">kg</span></span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-right flex-shrink-0 space-y-0.5">
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-[9px] text-slate-400 uppercase font-bold tracking-widest leading-none">Stock Total ..</span>
                            <span className="text-sm font-bold text-slate-600 leading-none">
                              {article.total_stock} <span className="text-[10px] font-medium text-slate-400">un</span>
                            </span>
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-[9px] text-slate-400 uppercase font-bold tracking-widest leading-none">Stock Disponível ..</span>
                            <span className={`text-sm font-black leading-none ${article.available_stock > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                              {article.available_stock} <span className="text-[10px] font-medium text-slate-400">un</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-1 mt-1 pt-1 border-t border-slate-50">
                        {can('create') && (
                          <>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedStockArticle(article);
                                setStockForm(prev => ({ ...prev, type: 'IN' }));
                                setShowStockEntryForm(true);
                              }}
                              className="flex items-center gap-1 px-2 py-1 text-emerald-600 bg-emerald-50 hover:bg-emerald-500 hover:text-white rounded-lg transition-all border border-emerald-100 shadow-sm"
                              title="Entrada de Stock"
                            >
                              <PlusCircle size={14} />
                              <span className="text-[9px] font-bold uppercase tracking-wider">Entradas</span>
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedStockArticle(article);
                                setStockForm(prev => ({ ...prev, type: 'OUT' }));
                                setShowStockExitForm(true);
                              }}
                              className="flex items-center gap-1 px-2 py-1 text-red-600 bg-red-50 hover:bg-red-500 hover:text-white rounded-lg transition-all border border-red-100 shadow-sm"
                              title="Saída de Stock"
                            >
                              <MinusCircle size={14} />
                              <span className="text-[9px] font-bold uppercase tracking-wider">Saídas</span>
                            </button>
                          </>
                        )}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedStockArticle(article);
                            setStockFilter('ALL');
                            setView('article-stock');
                          }}
                          className="flex items-center gap-1 px-2 py-1 text-a2r-blue-dark bg-blue-50 hover:bg-a2r-blue-dark hover:text-white rounded-lg transition-all border border-blue-100 shadow-sm"
                          title="Movimentos de Stock"
                        >
                          <History size={14} />
                          <span className="text-[9px] font-bold uppercase tracking-wider">Movimentos</span>
                        </button>
                        {can('edit') && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingArticle(article);
                              setArticleEditTab('variants');
                              setView('edit-article');
                            }}
                            className="flex items-center gap-1 px-2 py-1 text-amber-600 bg-amber-50 hover:bg-amber-500 hover:text-white rounded-lg transition-all border border-amber-100 shadow-sm"
                            title="Modelos do Artigo"
                          >
                            <Box size={14} />
                            <span className="text-[9px] font-bold uppercase tracking-wider">Modelos</span>
                          </button>
                        )}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShareArticle(article);
                          }}
                          className="p-1.5 bg-slate-50 text-slate-400 hover:bg-slate-800 hover:text-white transition-all border border-slate-100 rounded-lg shadow-sm"
                          title="Partilhar Artigo"
                        >
                          <Share2 size={14} />
                        </button>
                        {can('delete') && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              confirmDeleteArticle(article.id);
                            }}
                            className="p-1.5 bg-slate-50 text-slate-400 hover:bg-red-600 hover:text-white transition-all border border-slate-100 rounded-lg shadow-sm"
                            title="Eliminar Artigo"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {view === 'edit-article' && editingArticle && (
            <motion.div 
              key="edit-article"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col h-full max-w-4xl mx-auto bg-white rounded-3xl p-8 border border-slate-100 shadow-xl overflow-hidden"
            >
              <div className="flex items-center justify-between mb-6 shrink-0">
                <h2 className="text-2xl font-bold text-slate-800">Editar Artigo</h2>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setArticleEditTab('general')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${articleEditTab === 'general' ? 'bg-white text-a2r-blue-dark shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Dados Gerais
                  </button>
                  <button
                    onClick={() => setArticleEditTab('variants')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${articleEditTab === 'variants' ? 'bg-white text-a2r-blue-dark shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Modelos ({variants.length})
                  </button>
                </div>
              </div>

              {articleEditTab === 'general' ? (
                <form onSubmit={handleEditArticle} className="flex flex-col h-full overflow-hidden">
                  <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end">
                      <div className="lg:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Código</label>
                        <input 
                          type="text" 
                          required
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light"
                          value={editingArticle.code ?? ''}
                          onChange={e => setEditingArticle({...editingArticle, code: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Stock Total</label>
                        <div className="flex gap-1">
                          <input 
                            type="number" 
                            disabled
                            className="w-full px-3 py-2 rounded-xl border border-slate-100 bg-slate-50 text-slate-500 cursor-not-allowed outline-none text-center"
                            value={editingArticle.total_stock ?? 0}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const articleMovements = stockMovements.filter(m => m.article_id === editingArticle.id);
                              const calculatedTotal = articleMovements.reduce((acc, m) => acc + (m.type === 'IN' ? m.quantity : -m.quantity), 0);
                              setEditingArticle({...editingArticle, total_stock: calculatedTotal});
                              showToast('Stock total recalculado com sucesso!', 'success');
                            }}
                            className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors shrink-0"
                            title="Recalcular Stock Total"
                          >
                            <RefreshCw size={18} />
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Stock Disponível</label>
                        <div className="flex gap-1">
                          <input 
                            type="number" 
                            disabled
                            className="w-full px-3 py-2 rounded-xl border border-slate-100 bg-slate-50 text-slate-500 cursor-not-allowed outline-none text-center"
                            value={editingArticle.available_stock ?? 0}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const articleMovements = stockMovements.filter(m => m.article_id === editingArticle.id);
                              const calculatedTotal = articleMovements.reduce((acc, m) => acc + (m.type === 'IN' ? m.quantity : -m.quantity), 0);
                              
                              const articleOutputs = outputs.filter(o => o.items?.some(i => i.article_id === editingArticle.id));
                              const materialNoLocal = articleOutputs.reduce((acc, o) => {
                                const item = o.items?.find(i => i.article_id === editingArticle.id);
                                return acc + ((item?.quantity_out || 0) - (item?.quantity_in || 0));
                              }, 0);
                              
                              const calculatedAvailable = calculatedTotal - materialNoLocal;
                              
                              setEditingArticle({
                                ...editingArticle, 
                                available_stock: calculatedAvailable
                              });
                              showToast('Stock disponível recalculado com sucesso!', 'success');
                            }}
                            className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors shrink-0"
                            title="Recalcular Stock Disponível"
                          >
                            <RefreshCw size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                      <input 
                        type="text" 
                        required
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light"
                        value={editingArticle.description ?? ''}
                        onChange={e => setEditingArticle({...editingArticle, description: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-widest ml-1">Família / SubFamília</label>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Combobox 
                            value={getCategoryDisplayName(editingArticle.categoria_id)}
                            onChange={(val) => {
                              const cat = categories.find(c => getCategoryDisplayName(c.id) === val);
                              setEditingArticle({...editingArticle, categoria_id: cat ? cat.id : null});
                            }}
                            options={categories.map(c => getCategoryDisplayName(c.id))}
                            placeholder="Pesquisar Família..."
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light"
                            listId="edit-article-category"
                            inputRef={editArticleCategoryRef}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setCategoryPickerReturnView('edit-article');
                            setCategorySearch('');
                            setView('category-picker');
                          }}
                          className="p-2 bg-slate-100 text-slate-500 rounded-xl hover:bg-a2r-blue-dark hover:text-white transition-all shadow-sm border border-slate-200"
                          title="Selecionar na Lista"
                        >
                          <Search size={20} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCategoriesReturnView('edit-article');
                            setView('categories');
                          }}
                          className="p-2 bg-slate-100 text-slate-500 rounded-xl hover:bg-a2r-blue-dark hover:text-white transition-all shadow-sm border border-slate-200"
                          title="Gerir Famílias"
                        >
                          <Layers size={20} />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Altura (cm)</label>
                        <input 
                          type="number" 
                          step="0.01"
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light"
                          value={editingArticle.height ?? ''}
                          onChange={e => setEditingArticle({...editingArticle, height: parseFloat(e.target.value) || 0})}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Largura (cm)</label>
                        <input 
                          type="number" 
                          step="0.01"
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light"
                          value={editingArticle.width ?? ''}
                          onChange={e => setEditingArticle({...editingArticle, width: parseFloat(e.target.value) || 0})}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Compr. (cm)</label>
                        <input 
                          type="number" 
                          step="0.01"
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light"
                          value={editingArticle.length ?? ''}
                          onChange={e => setEditingArticle({...editingArticle, length: parseFloat(e.target.value) || 0})}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Peso (kg)</label>
                        <input 
                          type="number" 
                          step="0.01"
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light"
                          value={editingArticle.weight ?? ''}
                          onChange={e => setEditingArticle({...editingArticle, weight: parseFloat(e.target.value) || 0})}
                        />
                      </div>
                    </div>
                    <PhotoUpload 
                      onPhotoCapture={base64 => setEditingArticle({...editingArticle, photo: base64})}
                      currentPhoto={editingArticle.photo}
                    />
                  </div>
                  <div className="flex gap-4 pt-6 shrink-0 border-t border-slate-50 mt-auto">
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        if (editingArticle?.id) {
                          confirmDeleteArticle(editingArticle.id);
                        }
                      }}
                      className="px-6 py-3 rounded-xl border border-red-200 text-red-500 font-medium hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      Eliminar
                    </button>
                    <div className="flex-1 flex gap-4">
                      <button 
                        type="button"
                        onClick={() => setView('articles')}
                        className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50"
                      >
                        Cancelar
                      </button>
                      <button 
                        type="submit"
                        disabled={loading}
                        className="flex-1 py-3 rounded-xl a2r-gradient text-white font-medium hover:opacity-90 disabled:opacity-50"
                      >
                        {loading ? 'A guardar...' : 'Atualizar Artigo'}
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                <div className="flex flex-col h-full overflow-hidden">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-700">Modelos do Artigo</h3>
                    <button
                      onClick={() => {
                        setNewVariant({
                          name: '',
                          description: editingArticle.description,
                          height: editingArticle.height,
                          width: editingArticle.width,
                          length: editingArticle.length,
                          weight: editingArticle.weight,
                          photo: ''
                        });
                        setShowVariantForm(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-all shadow-sm"
                    >
                      <Plus size={18} />
                      Novo Modelo
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                    {variants.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                        <Box size={48} className="mb-4 opacity-20" />
                        <p className="font-medium">Este artigo ainda não tem modelos associados.</p>
                        <p className="text-sm">Crie variantes para diferentes tamanhos ou modelos.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {variants.map(variant => (
                          <div key={variant.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 hover:border-a2r-blue-light transition-all group">
                            <div className="flex gap-4">
                              <div className="w-20 h-20 rounded-xl bg-white border border-slate-100 overflow-hidden flex-shrink-0">
                                {variant.photo ? (
                                  <img src={variant.photo} alt={variant.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                                    <ImageOff size={24} />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-slate-800 truncate mb-2">{variant.name}</h4>
                                <div className="flex flex-wrap gap-2">
                                  <span className="text-[10px] bg-white px-2 py-0.5 rounded-md border border-slate-100 text-slate-600">
                                    {variant.height}x{variant.width}x{variant.length} cm
                                  </span>
                                  {variant.weight && (
                                    <span className="text-[10px] bg-white px-2 py-0.5 rounded-md border border-slate-100 text-slate-600">
                                      {variant.weight} kg
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-200/50">
                              <button
                                onClick={() => handleShareVariant(variant, editingArticle)}
                                className="p-2 text-slate-400 hover:text-a2r-blue-dark hover:bg-white rounded-lg transition-all"
                                title="Partilhar Modelo"
                              >
                                <Share2 size={16} />
                              </button>
                              <button
                                onClick={() => setEditingVariant(variant)}
                                className="p-2 text-slate-400 hover:text-a2r-blue-dark hover:bg-white rounded-lg transition-all"
                                title="Editar Modelo"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteVariant(variant.id)}
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-white rounded-lg transition-all"
                                title="Eliminar Modelo"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-6 shrink-0 border-t border-slate-50 mt-auto">
                    <button 
                      type="button"
                      onClick={() => setView('articles')}
                      className="w-full py-3 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50"
                    >
                      Voltar aos Artigos
                    </button>
                  </div>
                </div>
              )}

              {/* Variant Creation Modal */}
              {showVariantForm && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-3xl p-8 w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                  >
                    <h3 className="text-xl font-bold mb-6 text-slate-800">Novo Modelo</h3>
                    <form onSubmit={handleAddVariant} className="flex flex-col overflow-hidden">
                      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Descrição do artigo</label>
                          <input 
                            type="text" 
                            readOnly
                            tabIndex={-1}
                            className="w-full px-4 py-2 rounded-xl border border-slate-100 bg-slate-50 text-slate-500 outline-none cursor-default"
                            value={editingArticle?.description || ''}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Modelo</label>
                          <input 
                            type="text" 
                            required
                            placeholder="Ex: Modelo XL, Versão Luxo..."
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                            value={newVariant.name || ''}
                            onChange={e => setNewVariant({...newVariant, name: e.target.value})}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Altura (cm)</label>
                            <input 
                              type="number" 
                              step="0.01"
                              className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                              value={newVariant.height || ''}
                              onChange={e => setNewVariant({...newVariant, height: parseFloat(e.target.value) || 0})}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Largura (cm)</label>
                            <input 
                              type="number" 
                              step="0.01"
                              className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                              value={newVariant.width || ''}
                              onChange={e => setNewVariant({...newVariant, width: parseFloat(e.target.value) || 0})}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Comprimento (cm)</label>
                            <input 
                              type="number" 
                              step="0.01"
                              className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                              value={newVariant.length || ''}
                              onChange={e => setNewVariant({...newVariant, length: parseFloat(e.target.value) || 0})}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Peso (kg)</label>
                            <input 
                              type="number" 
                              step="0.01"
                              className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                              value={newVariant.weight || ''}
                              onChange={e => setNewVariant({...newVariant, weight: parseFloat(e.target.value) || 0})}
                            />
                          </div>
                        </div>
                        <PhotoUpload 
                          onPhotoCapture={base64 => setNewVariant({...newVariant, photo: base64})}
                          currentPhoto={newVariant.photo}
                        />
                      </div>
                      <div className="flex gap-4 pt-6 mt-4 border-t border-slate-100">
                        <button 
                          type="button"
                          onClick={() => setShowVariantForm(false)}
                          className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50"
                        >
                          Cancelar
                        </button>
                        <button 
                          type="submit"
                          disabled={loading}
                          className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-medium hover:bg-emerald-600 disabled:opacity-50"
                        >
                          {loading ? 'A guardar...' : 'Criar Modelo'}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}

              {/* Variant Editing Modal */}
              {editingVariant && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-3xl p-8 w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                  >
                    <h3 className="text-xl font-bold mb-6 text-slate-800">Editar Modelo</h3>
                    <form onSubmit={handleEditVariant} className="flex flex-col overflow-hidden">
                      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Descrição do artigo</label>
                          <input 
                            type="text" 
                            readOnly
                            tabIndex={-1}
                            className="w-full px-4 py-2 rounded-xl border border-slate-100 bg-slate-50 text-slate-500 outline-none cursor-default"
                            value={editingArticle?.description || ''}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Modelo</label>
                          <input 
                            type="text" 
                            required
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light"
                            value={editingVariant.name || ''}
                            onChange={e => setEditingVariant({...editingVariant, name: e.target.value})}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Altura (cm)</label>
                            <input 
                              type="number" 
                              step="0.01"
                              className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light"
                              value={editingVariant.height || ''}
                              onChange={e => setEditingVariant({...editingVariant, height: parseFloat(e.target.value) || 0})}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Largura (cm)</label>
                            <input 
                              type="number" 
                              step="0.01"
                              className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light"
                              value={editingVariant.width || ''}
                              onChange={e => setEditingVariant({...editingVariant, width: parseFloat(e.target.value) || 0})}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Comprimento (cm)</label>
                            <input 
                              type="number" 
                              step="0.01"
                              className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light"
                              value={editingVariant.length || ''}
                              onChange={e => setEditingVariant({...editingVariant, length: parseFloat(e.target.value) || 0})}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Peso (kg)</label>
                            <input 
                              type="number" 
                              step="0.01"
                              className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light"
                              value={editingVariant.weight || ''}
                              onChange={e => setEditingVariant({...editingVariant, weight: parseFloat(e.target.value) || 0})}
                            />
                          </div>
                        </div>
                        <PhotoUpload 
                          onPhotoCapture={base64 => setEditingVariant({...editingVariant, photo: base64})}
                          currentPhoto={editingVariant.photo}
                        />
                      </div>
                      <div className="flex gap-4 pt-6 mt-4 border-t border-slate-100">
                        <button 
                          type="button"
                          onClick={() => setEditingVariant(null)}
                          className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50"
                        >
                          Cancelar
                        </button>
                        <button 
                          type="submit"
                          disabled={loading}
                          className="flex-1 py-3 rounded-xl a2r-gradient text-white font-medium hover:opacity-90 disabled:opacity-50"
                        >
                          {loading ? 'A guardar...' : 'Atualizar Modelo'}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}

          {view === 'calendar' && (
            <motion.div
              key="calendar"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col flex-1 min-h-0 space-y-6"
            >
              <div className="flex items-center justify-between shrink-0">
                <h2 className="text-2xl font-bold text-slate-800">
                  {showCalendarDetail ? `Detalhes: ${formatDateDisplay(calendarDate)}` : 'Calendário'}
                </h2>
                <div className="flex gap-2">
                  {showCalendarDetail ? (
                    <button 
                      onClick={() => setShowCalendarDetail(false)}
                      className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-medium hover:bg-slate-200 transition-all flex items-center gap-2"
                    >
                      <ChevronLeft size={18} />
                      Voltar ao Mês
                    </button>
                  ) : (
                    <>
                      <button 
                        onClick={() => {
                          setCalendarViewDate(new Date());
                          setCalendarDate(new Date().toISOString().split('T')[0]);
                        }}
                        className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-medium hover:bg-slate-200 transition-all"
                      >
                        Hoje
                      </button>
                      <button 
                        onClick={() => setView('menu')}
                        className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <X size={24} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {!showCalendarDetail ? (
                <div className="flex flex-col h-full bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
                  {/* Calendar Header */}
                  <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h3 className="text-xl font-bold text-slate-800 capitalize">
                      {calendarViewDate.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}
                    </h3>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1))}
                        className="p-2 hover:bg-white rounded-xl border border-slate-200 transition-all text-slate-600"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <button 
                        onClick={() => setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1))}
                        className="p-2 hover:bg-white rounded-xl border border-slate-200 transition-all text-slate-600"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>
                  </div>

                  {/* Calendar Grid Headers */}
                  <div className="px-4 pt-4 shrink-0">
                    <div className="grid grid-cols-7 gap-1 sm:gap-2">
                      {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day, index) => (
                        <div key={day} className={`text-center text-[10px] font-bold uppercase tracking-widest py-2 ${index >= 5 ? 'text-red-600' : 'text-slate-400'}`}>
                          {day}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Calendar Grid Body */}
                  <div className="flex-1 overflow-y-auto p-4 pt-0 custom-scrollbar">
                    <div className="grid grid-cols-7 gap-1 sm:gap-2">
                      {(() => {
                        const year = calendarViewDate.getFullYear();
                        const month = calendarViewDate.getMonth();
                        const daysInMonth = new Date(year, month + 1, 0).getDate();
                        const firstDay = new Date(year, month, 1).getDay();
                        const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;
                        const days = [];

                        // Empty slots for previous month
                        for (let i = 0; i < adjustedFirstDay; i++) {
                          days.push(<div key={`empty-${i}`} className="aspect-square"></div>);
                        }

                        // Days of current month
                        for (let d = 1; d <= daysInMonth; d++) {
                          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                          const dObj = new Date(year, month, d);
                          const isToday = dateStr === new Date().toISOString().split('T')[0];
                          const isWeekend = dObj.getDay() === 0 || dObj.getDay() === 6;
                          const isHolidayDay = isHoliday(dObj);
                          const isSpecialDay = isWeekend || isHolidayDay;
                          
                          // Calculate counts
                          const entregaCount = outputs.filter(o => o.delivery_date?.split('T')[0] === dateStr).length;
                          const recolhaAtivaCount = outputs.filter(o => 
                            o.collection_date?.split('T')[0] === dateStr && 
                            o.items?.some(item => item.quantity_out > item.quantity_in)
                          ).length;
                          const recolhaEfetuadaCount = movements.filter(m => 
                            m.type === 'IN' && 
                            m.date.split('T')[0] === dateStr &&
                            (m.observations?.includes('Recolha') || m.observations?.includes('Retorno'))
                          ).length;

                          days.push(
                            <button
                              key={d}
                              onClick={() => {
                                setCalendarDate(dateStr);
                                setShowCalendarDetail(true);
                              }}
                              className={`aspect-square p-2 rounded-2xl border transition-all flex flex-col items-center justify-between relative group ${
                                isToday 
                                  ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-100' 
                                  : isHolidayDay
                                    ? 'bg-orange-50/50 border-orange-100 hover:border-orange-200 hover:shadow-md'
                                    : isWeekend
                                      ? 'bg-red-50/30 border-red-100 hover:border-red-200 hover:shadow-md'
                                      : 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-md'
                              }`}
                            >
                              <span className={`text-sm font-bold ${isToday ? 'text-indigo-600' : isHolidayDay ? 'text-orange-600' : isWeekend ? 'text-red-600' : 'text-slate-700'}`}>{d}</span>
                              
                              <div className="flex flex-col gap-0.5 w-full mt-1">
                                {entregaCount > 0 && (
                                  <div className="flex items-center justify-center bg-red-500 text-white text-[8px] font-bold rounded-full h-3 min-w-3 px-1">
                                    {entregaCount}
                                  </div>
                                )}
                                {recolhaAtivaCount > 0 && (
                                  <div className="flex items-center justify-center bg-emerald-500 text-white text-[8px] font-bold rounded-full h-3 min-w-3 px-1">
                                    {recolhaAtivaCount}
                                  </div>
                                )}
                                {recolhaEfetuadaCount > 0 && (
                                  <div className="flex items-center justify-center bg-blue-500 text-white text-[8px] font-bold rounded-full h-3 min-w-3 px-1">
                                    {recolhaEfetuadaCount}
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        }
                        return days;
                      })()}
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-wrap gap-4 justify-center">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Entregas</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Recolhas Ativas</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Recolhas Efetuadas</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto pr-2 space-y-8 custom-scrollbar pb-20">
                  {/* Calendar Filters */}
                  <div className="flex flex-col gap-4 mb-6">
                    <div className="flex items-center justify-between bg-slate-50 p-2 rounded-2xl border border-slate-200">
                      <div className="flex gap-1">
                        <button 
                          onClick={() => setCalendarFilter('ALL')}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all ${calendarFilter === 'ALL' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}
                        >
                          Todos
                        </button>
                        <button 
                          onClick={() => setCalendarFilter('ENTREGAS')}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all ${calendarFilter === 'ENTREGAS' ? 'bg-red-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}
                        >
                          Entregas
                        </button>
                        <button 
                          onClick={() => setCalendarFilter('ATIVAS')}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all ${calendarFilter === 'ATIVAS' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}
                        >
                          Ativas
                        </button>
                        <button 
                          onClick={() => setCalendarFilter('EFETUADAS')}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all ${calendarFilter === 'EFETUADAS' ? 'bg-blue-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}
                        >
                          Efetuadas
                        </button>
                      </div>
                      <button 
                        onClick={() => handlePrintDailyReport(calendarDate)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white rounded-xl text-[10px] font-bold uppercase hover:bg-slate-900 transition-all shadow-sm"
                      >
                        <BarChart3 size={14} />
                        Dashboard
                      </button>
                    </div>
                  </div>

                  {/* Entregas Section */}
                  {(calendarFilter === 'ALL' || calendarFilter === 'ENTREGAS') && (
                    <section className="space-y-4">
                      <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-red-500"></div>
                          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Entregas do Dia</h3>
                        </div>
                        <button 
                          onClick={() => handlePrintCategoryReport(calendarDate, 'ENTREGAS')}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="Relatório de Entregas"
                        >
                          <FileText size={16} />
                        </button>
                      </div>
                      {(() => {
                        const dayOutputs = outputs.filter(o => o.delivery_date?.split('T')[0] === calendarDate);
                        if (dayOutputs.length === 0) return <p className="text-sm text-slate-400 italic px-2">Nenhuma entrega agendada para este dia.</p>;
                        return dayOutputs.map(output => {
                          const isExpanded = expandedEntregas[output.id] || false;
                          return (
                            <div key={`cal-out-${output.id}`} className="bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all overflow-hidden">
                              <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                  <div className="flex flex-wrap gap-2">
                                    <span className="text-[10px] font-bold text-red-500 uppercase bg-red-50 px-2 py-1 rounded-lg">#{output.id}</span>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-100 px-2 py-1 rounded-lg">{output.type}</span>
                                  </div>
                                  <div className="flex gap-2">
                                    <button 
                                      onClick={() => handlePrintOutput(output)}
                                      className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"
                                      title="Imprimir PDF"
                                    >
                                      <Printer size={18} />
                                    </button>
                                    <button 
                                      onClick={() => handleMailtoOutput(output)}
                                      className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-xl transition-all"
                                      title="Enviar por Email"
                                    >
                                      <Mail size={18} />
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setEditingOutputId(output.id);
                                        setOutputForm({
                                          type: output.type,
                                          client_name: output.client_name,
                                          client_contact: output.client_contact,
                                          delivery_date: formatDateForInput(output.delivery_date),
                                          assembly_date: formatDateForInput(output.assembly_date),
                                          collection_date: formatDateForInput(output.collection_date),
                                          with_assembly: output.with_assembly,
                                          location_name: output.location_name,
                                          space_at_location: output.space_at_location,
                                          delivery_employee: output.delivery_employee,
                                          collection_employee: output.collection_employee,
                                          items: [...(output.items || [])]
                                        });
                                        setShowOutputForm(true);
                                        setView('outputs');
                                        setViewSource('calendar');
                                      }}
                                      className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                                      title="Editar"
                                    >
                                      <Edit size={18} />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteOutput(output.id)}
                                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                      title="Eliminar"
                                    >
                                      <Trash2 size={18} />
                                    </button>
                                    <button 
                                      onClick={() => setExpandedEntregas(prev => ({ ...prev, [output.id]: !isExpanded }))}
                                      className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-xl transition-all"
                                      title={isExpanded ? "Ocultar Artigos" : "Ver Artigos"}
                                    >
                                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                    </button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="space-y-3">
                                    <div>
                                      <p className="font-bold text-slate-800">{output.client_name}</p>
                                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                        <Phone size={12} />
                                        {output.client_contact}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-sm text-slate-700 font-medium flex items-center gap-1">
                                        <MapPin size={14} className="text-slate-400" />
                                        {output.location_name}
                                      </p>
                                      {output.space_at_location && (
                                        <p className="text-xs text-slate-500 mt-0.5 ml-4.5 italic">{output.space_at_location}</p>
                                      )}
                                    </div>
                                  </div>

                                    <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                      <div className="text-center">
                                        <p className="text-[8px] font-bold text-slate-400 uppercase mb-1">Quem vai entregar</p>
                                        <p className="text-[10px] font-bold text-slate-700">{formatDateDisplay(output.delivery_date)}</p>
                                        <p className="text-[9px] text-slate-500 mb-1">{formatTimeDisplay(output.delivery_date)}</p>
                                        <Combobox 
                                          value={output.delivery_employee || ''}
                                          onChange={val => handleUpdateOutputEmployee(output.id, { delivery_employee: val })}
                                          options={employees.map(e => e.name)}
                                          placeholder="Funcionário..."
                                          className="text-[8px] font-bold px-1 py-0.5 rounded border outline-none w-full bg-white text-slate-600 border-slate-200"
                                          listId={`delivery-emp-${output.id}`}
                                        />
                                      </div>
                                      <div className="text-center border-x border-slate-200">
                                        <p className="text-[8px] font-bold text-slate-400 uppercase mb-1">Montagem</p>
                                        <p className="text-[10px] font-bold text-slate-700">{formatDateDisplay(output.assembly_date)}</p>
                                        <p className="text-[9px] text-slate-500">{formatTimeDisplay(output.assembly_date)}</p>
                                      </div>
                                      <div className="text-center">
                                        <p className="text-[8px] font-bold text-slate-400 uppercase mb-1">Quem fez recolha</p>
                                        <p className="text-[10px] font-bold text-emerald-600">{formatDateDisplay(output.collection_date)}</p>
                                        <p className="text-[9px] text-emerald-500 mb-1">{formatTimeDisplay(output.collection_date)}</p>
                                        <Combobox 
                                          value={output.collection_employee || ''}
                                          onChange={val => handleUpdateOutputEmployee(output.id, { collection_employee: val })}
                                          options={employees.map(e => e.name)}
                                          placeholder="Funcionário..."
                                          className="text-[8px] font-bold px-1 py-0.5 rounded border outline-none w-full bg-white text-slate-600 border-slate-200"
                                          listId={`collection-emp-${output.id}`}
                                        />
                                      </div>
                                    <div className="col-span-3 text-right pt-1 border-t border-slate-200 mt-1">
                                      <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">
                                        Artigos Pendentes: {output.items?.filter(item => item.quantity_out > item.quantity_in).length}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Articles List (Collapsible) */}
                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="border-t border-slate-100 bg-slate-50/50"
                                  >
                                    <div className="p-4 space-y-2">
                                      {output.items?.map(item => (
                                        <div key={`item-${output.id}-${item.article_id}`} className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between shadow-sm">
                                          <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 border border-slate-100">
                                              <Package size={16} />
                                            </div>
                                            <div>
                                              <p className="text-xs font-bold text-slate-800">{item.article_description}</p>
                                              <p className="text-[10px] text-slate-500">{item.article_code}</p>
                                            </div>
                                          </div>
                                          <div className="flex gap-4">
                                            <div className="text-center">
                                              <p className="text-sm font-black text-red-600">{item.quantity_out}</p>
                                              <p className="text-[8px] text-red-400 font-bold uppercase">Entregue</p>
                                            </div>
                                            <div className="text-center">
                                              <p className="text-sm font-black text-emerald-600">{item.quantity_in}</p>
                                              <p className="text-[8px] text-emerald-400 font-bold uppercase">Recolhido</p>
                                            </div>
                                            <div className="text-center border-l border-slate-100 pl-4">
                                              <p className="text-sm font-black text-red-500">{item.quantity_out - item.quantity_in}</p>
                                              <p className="text-[8px] text-red-400 font-bold uppercase">Falta</p>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        });
                      })()}
                    </section>
                  )}

                  {/* Recolhas Ativas Section */}
                  {(calendarFilter === 'ALL' || calendarFilter === 'ATIVAS') && (
                    <section className="space-y-4">
                      <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Recolhas Ativas (Agendadas)</h3>
                        </div>
                        <button 
                          onClick={() => handlePrintCategoryReport(calendarDate, 'ATIVAS')}
                          className="p-1.5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                          title="Relatório de Recolhas Ativas"
                        >
                          <FileText size={16} />
                        </button>
                        <button 
                          onClick={() => handlePrintCategoryReport(calendarDate, 'ATIVAS')}
                          className="p-1.5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                          title="Relatório de Recolhas Ativas"
                        >
                          <FileText size={16} />
                        </button>
                      </div>
                      {(() => {
                        const dayActiveRecolhas = outputs.filter(o => 
                          o.collection_date?.split('T')[0] === calendarDate && 
                          o.items?.some(item => item.quantity_out > item.quantity_in)
                        );
                        if (dayActiveRecolhas.length === 0) return <p className="text-sm text-slate-400 italic px-2">Nenhuma recolha ativa agendada para este dia.</p>;
                        return dayActiveRecolhas.map(output => {
                          const isExpanded = expandedAtivas[output.id] || false;
                          return (
                            <div key={`cal-act-${output.id}`} className="bg-white rounded-3xl border border-emerald-100 shadow-sm hover:shadow-md transition-all border-l-4 border-l-emerald-500 overflow-hidden">
                              <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                  <div className="flex flex-wrap gap-2">
                                    <span className="text-[10px] font-bold text-emerald-500 uppercase bg-emerald-50 px-2 py-1 rounded-lg">#{output.id}</span>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-100 px-2 py-1 rounded-lg">{output.type}</span>
                                  </div>
                                  <div className="flex gap-2">
                                    <button 
                                      onClick={() => handlePrintOutput(output)}
                                      className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"
                                      title="Imprimir PDF"
                                    >
                                      <Printer size={18} />
                                    </button>
                                    <button 
                                      onClick={() => handleMailtoOutput(output)}
                                      className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-xl transition-all"
                                      title="Enviar por Email"
                                    >
                                      <Mail size={18} />
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setEditingOutputId(output.id);
                                        setOutputForm({
                                          type: output.type,
                                          client_name: output.client_name,
                                          client_contact: output.client_contact,
                                          delivery_date: formatDateForInput(output.delivery_date),
                                          assembly_date: formatDateForInput(output.assembly_date),
                                          collection_date: formatDateForInput(output.collection_date),
                                          with_assembly: output.with_assembly,
                                          location_name: output.location_name,
                                          space_at_location: output.space_at_location,
                                          delivery_employee: output.delivery_employee,
                                          collection_employee: output.collection_employee,
                                          items: [...(output.items || [])]
                                        });
                                        setShowOutputForm(true);
                                        setView('outputs');
                                        setViewSource('calendar');
                                      }}
                                      className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                                      title="Editar"
                                    >
                                      <Edit size={18} />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteOutput(output.id)}
                                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                      title="Eliminar"
                                    >
                                      <Trash2 size={18} />
                                    </button>
                                    <button 
                                      onClick={() => setExpandedAtivas(prev => ({ ...prev, [output.id]: !isExpanded }))}
                                      className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"
                                      title={isExpanded ? "Ocultar Artigos" : "Ver Artigos"}
                                    >
                                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                    </button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                  <div className="space-y-3">
                                    <div>
                                      <p className="font-bold text-slate-800">{output.client_name}</p>
                                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                        <Phone size={12} />
                                        {output.client_contact}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-sm text-slate-700 font-medium flex items-center gap-1">
                                        <MapPin size={14} className="text-slate-400" />
                                        {output.location_name}
                                      </p>
                                      {output.space_at_location && (
                                        <p className="text-xs text-slate-500 mt-0.5 ml-4.5 italic">{output.space_at_location}</p>
                                      )}
                                    </div>
                                  </div>

                                    <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                      <div className="text-center">
                                        <p className="text-[8px] font-bold text-slate-400 uppercase mb-1">Quem vai entregar</p>
                                        <p className="text-[10px] font-bold text-slate-700">{formatDateDisplay(output.delivery_date)}</p>
                                        <p className="text-[9px] text-slate-500 mb-1">{formatTimeDisplay(output.delivery_date)}</p>
                                        <Combobox 
                                          value={output.delivery_employee || ''}
                                          onChange={val => handleUpdateOutputEmployee(output.id, { delivery_employee: val })}
                                          options={employees.map(e => e.name)}
                                          placeholder="Funcionário..."
                                          className="text-[8px] font-bold px-1 py-0.5 rounded border outline-none w-full bg-white text-slate-600 border-slate-200"
                                          listId={`delivery-emp-act-${output.id}`}
                                        />
                                      </div>
                                      <div className="text-center border-x border-slate-200">
                                        <p className="text-[8px] font-bold text-slate-400 uppercase mb-1">Montagem</p>
                                        <p className="text-[10px] font-bold text-slate-700">{formatDateDisplay(output.assembly_date)}</p>
                                        <p className="text-[9px] text-slate-500">{formatTimeDisplay(output.assembly_date)}</p>
                                      </div>
                                      <div className="text-center">
                                        <p className="text-[8px] font-bold text-slate-400 uppercase mb-1">Quem fez recolha</p>
                                        <p className="text-[10px] font-bold text-emerald-600">{formatDateDisplay(output.collection_date)}</p>
                                        <p className="text-[9px] text-emerald-500 mb-1">{formatTimeDisplay(output.collection_date)}</p>
                                        <Combobox 
                                          value={output.collection_employee || ''}
                                          onChange={val => handleUpdateOutputEmployee(output.id, { collection_employee: val })}
                                          options={employees.map(e => e.name)}
                                          placeholder="Funcionário..."
                                          className="text-[8px] font-bold px-1 py-0.5 rounded border outline-none w-full bg-white text-slate-600 border-slate-200"
                                          listId={`collection-emp-act-${output.id}`}
                                        />
                                      </div>
                                    <div className="col-span-3 text-right pt-1 border-t border-slate-200 mt-1">
                                      <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">
                                        Artigos Pendentes: {output.items?.filter(item => item.quantity_out > item.quantity_in).length}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Articles List (Collapsible) */}
                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="border-t border-slate-100 bg-slate-50/50"
                                  >
                                    <div className="p-4 space-y-2">
                                      {output.items?.filter(item => item.quantity_out > item.quantity_in).map(item => (
                                        <div key={`item-act-${output.id}-${item.article_id}`} className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between shadow-sm">
                                          <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-500 border border-emerald-100">
                                              <Package size={16} />
                                            </div>
                                            <div>
                                              <p className="text-xs font-bold text-slate-800">{item.article_description}</p>
                                              <p className="text-[10px] text-slate-500">{item.article_code}</p>
                                            </div>
                                          </div>
                                          <div className="flex gap-4">
                                            <div className="text-center">
                                              <p className="text-sm font-black text-slate-400">{item.quantity_out}</p>
                                              <p className="text-[8px] text-slate-400 font-bold uppercase">Entregue</p>
                                            </div>
                                            <div className="text-center">
                                              <p className="text-sm font-black text-emerald-600">{item.quantity_in}</p>
                                              <p className="text-[8px] text-emerald-400 font-bold uppercase">Recolhido</p>
                                            </div>
                                            <div className="text-center border-l border-slate-100 pl-4">
                                              <p className="text-sm font-black text-red-500">{item.quantity_out - item.quantity_in}</p>
                                              <p className="text-[8px] text-red-400 font-bold uppercase">Falta</p>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        });
                      })()}
                    </section>
                  )}

                  {/* Recolhas Efetuadas Section */}
                  {(calendarFilter === 'ALL' || calendarFilter === 'EFETUADAS') && (
                    <section className="space-y-4">
                      <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Recolhas Efetuadas</h3>
                        </div>
                        <button 
                          onClick={() => handlePrintCategoryReport(calendarDate, 'EFETUADAS')}
                          className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                          title="Relatório de Recolhas Efetuadas"
                        >
                          <FileText size={16} />
                        </button>
                        <button 
                          onClick={() => handlePrintCategoryReport(calendarDate, 'EFETUADAS')}
                          className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                          title="Relatório de Recolhas Efetuadas"
                        >
                          <FileText size={16} />
                        </button>
                      </div>
                      {(() => {
                        const dayMovementsList = movements.filter(m => 
                          m.type === 'IN' && 
                          m.date.split('T')[0] === calendarDate &&
                          (m.observations?.includes('Recolha') || m.observations?.includes('Retorno'))
                        );
                        
                        if (dayMovementsList.length === 0) return <p className="text-sm text-slate-400 italic px-2">Nenhuma recolha efetuada neste dia.</p>;

                        // Group movements by Output ID
                        const groupedMovements = dayMovementsList.reduce((acc, movement) => {
                          const outputIdMatch = movement.observations?.match(/#(\d+)/);
                          const outputId = outputIdMatch ? parseInt(outputIdMatch[1]) : -1;
                          if (!acc[outputId]) acc[outputId] = [];
                          acc[outputId].push(movement);
                          return acc;
                        }, {} as Record<number, Movement[]>);

                        return Object.entries(groupedMovements).map(([outputIdStr, movementsInGroup]) => {
                          const groupMovements = movementsInGroup as Movement[];
                          const outputId = parseInt(outputIdStr);
                          const output = outputId !== -1 ? outputs.find(o => o.id === outputId) : null;
                          const isExpanded = expandedRecolhas[outputId] || false;
                          
                          return (
                            <div key={`cal-group-${outputId}`} className="bg-white rounded-3xl border border-blue-100 shadow-sm hover:shadow-md transition-all border-l-4 border-l-blue-500 overflow-hidden">
                              {/* Group Header */}
                              <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                  <div className="flex flex-wrap gap-2">
                                    {output ? (
                                      <>
                                        <span className="text-[10px] font-bold text-blue-500 uppercase bg-blue-50 px-2 py-1 rounded-lg">Entrega #{output.id}</span>
                                        <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-100 px-2 py-1 rounded-lg">{output.type}</span>
                                      </>
                                    ) : (
                                      <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-100 px-2 py-1 rounded-lg">Recolha Avulsa</span>
                                    )}
                                    <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-100 px-2 py-1 rounded-lg">{groupMovements.length} Movimentos</span>
                                  </div>
                                  <div className="flex gap-2">
                                    {output && (
                                      <>
                                        <button 
                                          onClick={() => handlePrintOutput(output)}
                                          className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"
                                          title="Imprimir PDF Entrega"
                                        >
                                          <Printer size={18} />
                                        </button>
                                        <button 
                                          onClick={() => handleMailtoOutput(output)}
                                          className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-xl transition-all"
                                          title="Enviar por Email"
                                        >
                                          <Mail size={18} />
                                        </button>
                                        <button 
                                          onClick={() => {
                                            setEditingOutputId(output.id);
                                            setOutputForm({
                                              type: output.type,
                                              client_name: output.client_name,
                                              client_contact: output.client_contact,
                                              delivery_date: formatDateForInput(output.delivery_date),
                                              assembly_date: formatDateForInput(output.assembly_date),
                                              collection_date: formatDateForInput(output.collection_date),
                                              with_assembly: output.with_assembly,
                                              location_name: output.location_name,
                                              space_at_location: output.space_at_location,
                                              delivery_employee: output.delivery_employee,
                                              collection_employee: output.collection_employee,
                                              items: [...(output.items || [])]
                                            });
                                            setShowOutputForm(true);
                                            setView('outputs');
                                            setViewSource('calendar');
                                          }}
                                          className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                                          title="Editar"
                                        >
                                          <Edit size={18} />
                                        </button>
                                        <button 
                                          onClick={() => handleDeleteOutput(output.id)}
                                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                          title="Eliminar"
                                        >
                                          <Trash2 size={18} />
                                        </button>
                                      </>
                                    )}
                                    <button 
                                      onClick={() => setExpandedRecolhas(prev => ({ ...prev, [outputId]: !isExpanded }))}
                                      className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                                      title={isExpanded ? "Ocultar Artigos" : "Ver Artigos"}
                                    >
                                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                    </button>
                                  </div>
                                </div>

                                {output ? (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                      <div>
                                        <p className="font-bold text-slate-800">{output.client_name}</p>
                                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                          <Phone size={12} />
                                          {output.client_contact}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-sm text-slate-700 font-medium flex items-center gap-1">
                                          <MapPin size={14} className="text-slate-400" />
                                          {output.location_name}
                                        </p>
                                        {output.space_at_location && (
                                          <p className="text-xs text-slate-500 mt-0.5 ml-4.5 italic">{output.space_at_location}</p>
                                        )}
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                      <div className="text-center">
                                        <p className="text-[8px] font-bold text-slate-400 uppercase mb-1">Quem vai entregar</p>
                                        <p className="text-[10px] font-bold text-slate-700">{formatDateDisplay(output.delivery_date)}</p>
                                        <p className="text-[9px] text-slate-500 mb-1">{formatTimeDisplay(output.delivery_date)}</p>
                                        <Combobox 
                                          value={output.delivery_employee || ''}
                                          onChange={val => handleUpdateOutputEmployee(output.id, { delivery_employee: val })}
                                          options={employees.map(e => e.name)}
                                          placeholder="Funcionário..."
                                          className="text-[8px] font-bold px-1 py-0.5 rounded border outline-none w-full bg-white text-slate-600 border-slate-200"
                                          listId={`delivery-emp-hist-${output.id}`}
                                        />
                                      </div>
                                      <div className="text-center border-x border-slate-200">
                                        <p className="text-[8px] font-bold text-slate-400 uppercase mb-1">Montagem</p>
                                        <p className="text-[10px] font-bold text-slate-700">{formatDateDisplay(output.assembly_date)}</p>
                                        <p className="text-[9px] text-slate-500">{formatTimeDisplay(output.assembly_date)}</p>
                                      </div>
                                      <div className="text-center">
                                        <p className="text-[8px] font-bold text-slate-400 uppercase mb-1">Quem fez recolha</p>
                                        <p className="text-[10px] font-bold text-emerald-600">{formatDateDisplay(output.collection_date)}</p>
                                        <p className="text-[9px] text-emerald-500 mb-1">{formatTimeDisplay(output.collection_date)}</p>
                                        <Combobox 
                                          value={output.collection_employee || ''}
                                          onChange={val => handleUpdateOutputEmployee(output.id, { collection_employee: val })}
                                          options={employees.map(e => e.name)}
                                          placeholder="Funcionário..."
                                          className="text-[8px] font-bold px-1 py-0.5 rounded border outline-none w-full bg-white text-slate-600 border-slate-200"
                                          listId={`collection-emp-hist-${output.id}`}
                                        />
                                      </div>
                                      <div className="col-span-3 text-right pt-1 border-t border-slate-200 mt-1">
                                        <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">
                                          Artigos Pendentes: {output.items?.filter(item => item.quantity_out > item.quantity_in).length}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-400 italic">Contexto da entrega não encontrado.</p>
                                )}
                                
                                {output && (
                                  <div className="hidden">
                                    {/* Hidden as requested, moved to grid above */}
                                  </div>
                                )}
                              </div>

                              {/* Articles List (Collapsible) */}
                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="border-t border-slate-100 bg-slate-50/50"
                                  >
                                    <div className="p-4 space-y-3">
                                      {groupMovements.map(movement => (
                                        <div key={`mov-item-${movement.id}`} className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between shadow-sm">
                                          <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-500 border border-blue-100">
                                              <Package size={16} />
                                            </div>
                                            <div>
                                              <p className="text-xs font-bold text-slate-800">{movement.article_description}</p>
                                              <p className="text-[10px] text-slate-500">{movement.article_code}</p>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-4">
                                            <div className="flex gap-4">
                                              {(() => {
                                                const item = output?.items?.find(i => i.article_id === movement.article_id);
                                                if (!item) return (
                                                  <div className="text-right">
                                                    <p className="text-lg font-black text-blue-600">{movement.quantity}</p>
                                                    <p className="text-[8px] text-blue-400 font-bold uppercase">Unidades</p>
                                                  </div>
                                                );
                                                return (
                                                  <>
                                                    <div className="text-center">
                                                      <p className="text-sm font-black text-slate-400">{item.quantity_out}</p>
                                                      <p className="text-[8px] text-slate-400 font-bold uppercase">Entregue</p>
                                                    </div>
                                                    <div className="text-center">
                                                      <p className="text-sm font-black text-emerald-600">{item.quantity_in}</p>
                                                      <p className="text-[8px] text-emerald-400 font-bold uppercase">Recolhido</p>
                                                    </div>
                                                    <div className="text-center border-l border-slate-100 pl-4">
                                                      <p className="text-sm font-black text-red-500">{item.quantity_out - item.quantity_in}</p>
                                                      <p className="text-[8px] text-red-400 font-bold uppercase">Falta</p>
                                                    </div>
                                                    <div className="text-center border-l border-slate-100 pl-4 bg-blue-50/50 px-2 rounded-lg">
                                                      <p className="text-sm font-black text-blue-600">{movement.quantity}</p>
                                                      <p className="text-[8px] text-blue-400 font-bold uppercase">Nesta Recolha</p>
                                                    </div>
                                                  </>
                                                );
                                              })()}
                                            </div>
                                            <div className="flex gap-1">
                                              <button 
                                                onClick={() => {
                                                  const outputIdMatch = movement.observations?.match(/#(\d+)/);
                                                  const outputId = outputIdMatch ? parseInt(outputIdMatch[1]) : null;
                                                  const output = outputId ? outputs.find(o => o.id === outputId) : null;
                                                  setReturnEmployee(output?.collection_employee || '');
                                                  setEditingMovementId(movement.id);
                                                  setEditingMovementData({
                                                    quantity: movement.quantity,
                                                    observations: movement.observations || ''
                                                  });
                                                  setShowInputForm(true);
                                                  setView('inputs');
                                                  setViewSource('calendar');
                                                }}
                                                className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                                              >
                                                <Edit size={14} />
                                              </button>
                                              <button 
                                                onClick={() => handleDeleteMovement(movement.id)}
                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                              >
                                                <Trash2 size={14} />
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        });
                      })()}
                  </section>
                )}
              </div>
            )}
          </motion.div>
        )}

          {view === 'position' && (
            <motion.div
              key="position"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col flex-1 min-h-0 space-y-6"
            >
              <div className="flex items-center justify-between shrink-0">
                <h2 className="text-2xl font-bold text-slate-800">Posição de Stock</h2>
                <button 
                  onClick={() => setView('menu')}
                  className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="shrink-0">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="Pesquisar artigo..."
                      className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                      value={positionSearchQuery}
                      onChange={e => {
                        setPositionSearchQuery(e.target.value);
                        const exactMatch = articles.find(a => (a.code?.toLowerCase() || '') === e.target.value.toLowerCase());
                        if (exactMatch) {
                          setPositionArticleId(exactMatch.id.toString());
                          setPositionSearchQuery(exactMatch.description);
                        }
                      }}
                    />
                    {positionSearchQuery && !positionArticleId && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-100 shadow-2xl z-50 max-h-60 overflow-y-auto">
                        {articles
                          .filter(a => 
                            (a.code?.toLowerCase() || '').includes(positionSearchQuery.toLowerCase()) || 
                            (a.description?.toLowerCase() || '').includes(positionSearchQuery.toLowerCase())
                          )
                          .map(art => (
                            <button
                              key={art.id}
                              onClick={() => {
                                setPositionArticleId(art.id.toString());
                                setPositionSearchQuery(art.description);
                              }}
                              className="w-full p-4 text-left hover:bg-slate-50 border-b border-slate-50 last:border-none flex items-center gap-3"
                            >
                              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 overflow-hidden">
                                {art.photo ? <img src={art.photo} className="w-full h-full object-cover" /> : <Package size={20} />}
                              </div>
                              <div>
                                <p className="font-bold text-slate-800 text-sm">{art.description}</p>
                                <p className="text-xs text-slate-400 font-mono">{art.code}</p>
                              </div>
                            </button>
                          ))}
                      </div>
                    )}
                    {positionArticleId && (
                      <button 
                        onClick={() => {
                          setPositionArticleId('');
                          setPositionSearchQuery('');
                        }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X size={18} />
                      </button>
                    )}
                  </div>
                  <button 
                    onClick={() => setShowArticleSearchModal(true)}
                    className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 hover:border-indigo-600 transition-all shadow-sm"
                    title="Pesquisa Avançada"
                  >
                    <Search size={20} />
                  </button>
                </div>
              </div>

              {positionArticleId && (
                <div className="flex-1 flex flex-col min-h-0 space-y-6">
                  {(() => {
                    const article = articles.find(a => a.id === parseInt(positionArticleId));
                    if (!article) return null;

                    const pendingDeliveries = outputs.reduce((sum, o) => {
                      const item = o.items?.find(i => i.article_id === article.id);
                      if (item) {
                        return sum + (item.quantity_out - item.quantity_in);
                      }
                      return sum;
                    }, 0);

                    const totalStock = article.available_stock + pendingDeliveries;

                    const articleMovements = outputs
                      .filter(o => o.items?.some(i => i.article_id === article.id))
                      .map(o => ({
                        type: o.type,
                        client_name: o.client_name,
                        client_contact: o.client_contact,
                        location: o.location_name,
                        space: o.space_at_location,
                        delivery_date: o.delivery_date,
                        collection_date: o.collection_date,
                        quantity: o.items?.find(i => i.article_id === article.id)?.quantity_out || 0,
                        returned: o.items?.find(i => i.article_id === article.id)?.quantity_in || 0
                      }))
                      .filter(m => (m.quantity - m.returned) > 0)
                      .sort((a, b) => {
                        const dateA = a.collection_date ? new Date(a.collection_date).getTime() : 0;
                        const dateB = b.collection_date ? new Date(b.collection_date).getTime() : 0;
                        return dateA - dateB;
                      });

                    return (
                      <>
                        <div className="grid grid-cols-3 gap-4 shrink-0 bg-slate-50/50 p-2 rounded-[2rem] border border-slate-100 shadow-inner sticky top-[72px] z-10">
                          <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm text-center">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Stock Atual</p>
                            <p className="text-2xl font-black text-slate-800">{article.available_stock}</p>
                          </div>
                          <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm text-center">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Entregas Pend.</p>
                            <p className="text-2xl font-black text-indigo-600">{pendingDeliveries}</p>
                          </div>
                          <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm text-center bg-indigo-50/30 border-indigo-100">
                            <p className="text-[10px] font-bold text-indigo-400 uppercase mb-1">Stock Total</p>
                            <p className="text-2xl font-black text-indigo-700">{totalStock}</p>
                          </div>
                        </div>

                        <div className="flex justify-end px-2">
                          <button 
                            onClick={() => generateStockReport(article, pendingDeliveries, totalStock, articleMovements)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white rounded-xl text-[10px] font-bold uppercase hover:bg-slate-900 transition-all shadow-sm"
                          >
                            <BarChart3 size={14} />
                            Dashboard
                          </button>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar pb-20">
                          <StockTimeline article={article} outputs={outputs} timelineRef={timelineRef} />
                          
                          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest px-2">Movimentos Ativos</h3>
                          {articleMovements.length === 0 ? (
                            <p className="text-sm text-slate-400 italic px-2">Nenhum movimento ativo para este artigo.</p>
                          ) : (
                            articleMovements.map((m, idx) => (
                              <div key={idx} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                                <div className="flex justify-between items-center">
                                  <div className="flex-1">
                                    <span className="text-[10px] font-bold text-indigo-500 uppercase bg-indigo-50 px-2 py-1 rounded-lg">{m.type}</span>
                                    <p className="font-bold text-slate-800 mt-2 text-lg">{m.location}</p>
                                    {m.space && <p className="text-xs text-slate-500 italic">{m.space}</p>}
                                    <div className="mt-3">
                                      <p className="text-xs font-bold text-slate-700 flex items-center gap-2">
                                        {m.client_name} 
                                        {m.client_contact && (
                                          <>
                                            <span className="text-slate-300 font-normal">|</span>
                                            <span className="text-slate-400 font-medium flex items-center gap-1">
                                              <Phone size={10} /> {m.client_contact}
                                            </span>
                                          </>
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <div className="bg-slate-50/50 px-3 py-3 rounded-2xl border border-slate-100 text-center w-28 h-16 flex flex-col justify-center">
                                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Entrega</p>
                                      <p className="text-[9px] font-bold text-slate-600 leading-tight">{formatFullDate(m.delivery_date)}</p>
                                    </div>
                                    <div className="bg-slate-50/50 px-3 py-3 rounded-2xl border border-slate-100 text-center w-28 h-16 flex flex-col justify-center">
                                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Recolha</p>
                                      <p className="text-[9px] font-bold text-indigo-600 leading-tight">{formatFullDate(m.collection_date)}</p>
                                    </div>
                                    <div className="bg-slate-50/50 px-3 py-3 rounded-2xl border border-slate-100 text-center w-28 h-16 flex flex-col justify-center">
                                      <p className="text-2xl font-black text-slate-800 leading-none mb-0.5">{m.quantity - m.returned}</p>
                                      <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Pendente</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </motion.div>
          )}

          {view === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col flex-1 min-h-0 space-y-6"
            >
              <div className="flex items-center justify-between shrink-0">
                <h2 className="text-2xl font-bold text-slate-800">Histórico</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={generateStockMovementsReport}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all shadow-sm"
                  >
                    <FileText size={18} />
                    Relatório PDF
                  </button>
                  <button 
                    onClick={() => setView('menu')}
                    className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Filtrar por artigo..."
                    className="w-full pl-12 pr-4 py-2 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-a2r-blue-light outline-none"
                    value={historyArticleFilter}
                    onFocus={() => setHistoryArticleFilter('')}
                    onChange={e => setHistoryArticleFilter(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-500 whitespace-nowrap">Desde:</span>
                  <input 
                    type="date" 
                    className="flex-1 px-4 py-2 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-a2r-blue-light outline-none"
                    value={historyStartDate}
                    onChange={e => setHistoryStartDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                {(() => {
                  const combinedHistory: any[] = [];
                  
                  // Add Entregas
                  outputs.forEach(o => {
                    o.items?.forEach(item => {
                      combinedHistory.push({
                        id: `E-${o.id}-${item.id}`,
                        type: 'ENTREGA',
                        date: o.delivery_date || o.created_at,
                        article_description: item.article_description,
                        article_code: item.article_code,
                        article_id: item.article_id,
                        quantity: item.quantity_out,
                        client_name: o.client_name,
                        client_contact: o.client_contact,
                        location_name: o.location_name,
                        space_at_location: o.space_at_location,
                        delivery_type: o.type,
                        user_name: o.user_name,
                        original_output: o
                      });
                    });
                  });

                  // Add Recolhas
                  movements.filter(m => m.type === 'IN' && m.observations?.includes('Recolha')).forEach(m => {
                    const outputIdMatch = m.observations?.match(/#(\d+)/);
                    const outputId = outputIdMatch ? parseInt(outputIdMatch[1]) : null;
                    const relatedOutput = outputId ? outputs.find(o => o.id === outputId) : null;

                    combinedHistory.push({
                      id: `R-${m.id}`,
                      type: 'RECOLHA',
                      date: m.date,
                      article_description: m.article_description,
                      article_code: m.article_code,
                      article_id: m.article_id,
                      quantity: m.quantity,
                      observations: m.observations,
                      user_name: m.user_name,
                      client_name: relatedOutput?.client_name || '',
                      client_contact: relatedOutput?.client_contact || '',
                      location_name: relatedOutput?.location_name || '',
                      space_at_location: relatedOutput?.space_at_location || '',
                      delivery_type: relatedOutput?.type || ''
                    });
                  });

                  const filtered = combinedHistory
                    .filter(h => {
                      const date = new Date(h.date);
                      const start = new Date(historyStartDate);
                      const matchesDate = date >= start;
                      const matchesArticle = (h.article_description?.toLowerCase() || '').includes(historyArticleFilter.toLowerCase()) ||
                                           (h.article_code?.toLowerCase() || '').includes(historyArticleFilter.toLowerCase());
                      return matchesDate && matchesArticle;
                    })
                    .sort((a, b) => {
                      const dateA = new Date(a.date).getTime();
                      const dateB = new Date(b.date).getTime();
                      if (dateA !== dateB) return dateA - dateB;
                      return a.article_description.localeCompare(b.article_description);
                    });

                  if (filtered.length === 0) {
                    return (
                      <div className="bg-white rounded-3xl p-12 border border-slate-100 shadow-xl text-center">
                        <History size={48} className="mx-auto text-slate-200 mb-4" />
                        <p className="text-slate-500">Nenhum registo encontrado com os filtros selecionados.</p>
                      </div>
                    );
                  }

                  return filtered.map(item => {
                    const article = articles.find(a => a.id === item.article_id);
                    const photo = article?.photo;

                    return (
                      <div key={item.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                        {/* Line 1: Type, Subtype, ID (if Entrega), Location, Space */}
                        <div className="flex items-center gap-2 mb-2 text-[10px] font-bold uppercase">
                          <span className={`px-2 py-0.5 rounded ${
                            item.type === 'ENTREGA' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
                          }`}>
                            {item.type}
                          </span>
                          {item.delivery_type && (
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                              {item.delivery_type}
                            </span>
                          )}
                          {item.type === 'ENTREGA' && (
                            <span className="text-slate-400 font-medium">#{item.id.split('-')[1]}</span>
                          )}
                          {(item.location_name || item.space_at_location) && (
                            <div className="flex items-center gap-1 text-slate-500 ml-auto">
                              <MapPin size={10} />
                              <span>{item.location_name} {item.space_at_location ? `(${item.space_at_location})` : ''}</span>
                            </div>
                          )}
                        </div>

                        {/* Line 2: Photo, Article, Qty, Date/Time */}
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 flex-shrink-0 overflow-hidden border border-slate-100">
                            {photo ? (
                              <img src={photo} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Package size={20} className="m-auto text-slate-300" />
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-bold text-slate-800 truncate">{item.article_description}</h3>
                            <p className="text-[10px] text-slate-400 font-mono truncate">{item.article_code}</p>
                            {item.client_name && (
                              <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                                {item.client_name} {item.client_contact ? `(${item.client_contact})` : ''}
                              </p>
                            )}
                          </div>

                          <div className="text-right">
                            <div className="text-lg font-black text-slate-700">
                              {item.quantity}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium">
                              {formatDateDisplay(item.date)} {formatTimeDisplay(item.date)}
                            </div>
                          </div>
                        </div>
                        
                        {/* Footer: User */}
                        <div className="mt-2 pt-2 border-t border-slate-50 flex justify-end items-center text-[9px] text-slate-300">
                          <div className="flex items-center gap-1">
                            <Clock size={10} />
                            {item.user_name}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </motion.div>
          )}

          {view === 'inputs' && (
            <motion.div
              key="inputs"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col flex-1 min-h-0 space-y-6"
            >
              <div className="flex items-center justify-between shrink-0">
                <h2 className="text-2xl font-bold text-slate-800">
                  {showInputForm ? (editingMovementId ? 'Editar Recolha' : 'Nova Recolha') : 'Recolhas'}
                </h2>
                <div className="flex gap-2">
                  {can('create') && (
                    <button 
                      onClick={() => {
                        setShowInputForm(!showInputForm);
                        if (!showInputForm) {
                          setSelectedOutputId('');
                          setReturnItems({});
                          setEditingMovementId(null);
                          setReturnEmployee('');
                        }
                      }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                        showInputForm 
                          ? 'bg-slate-100 text-slate-600' 
                          : 'bg-emerald-500 text-white shadow-lg shadow-emerald-100'
                      }`}
                    >
                      {showInputForm ? <X size={18} /> : <Plus size={18} />}
                      {showInputForm ? 'Cancelar' : 'Nova Recolha'}
                    </button>
                  )}
                  {!showInputForm && (
                    <button 
                      onClick={() => setView('menu')}
                      className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X size={24} />
                    </button>
                  )}
                </div>
              </div>

              {showInputForm ? (
                <div className="flex flex-col h-full bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
                  <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    {editingMovementId ? (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl font-bold text-emerald-600">Editar Recolha #{editingMovementId}</h3>
                          <button 
                            onClick={() => handleDeleteMovement(editingMovementId)}
                            className="p-2 text-red-400 hover:text-red-600 transition-colors"
                            title="Eliminar Recolha"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                            <p className="text-[10px] font-bold text-blue-400 uppercase mb-1">Funcionário de Entrega</p>
                            <p className="font-bold text-blue-700">
                              {(() => {
                                const movement = movements.find(m => m.id === editingMovementId);
                                const outputIdMatch = movement?.observations?.match(/#(\d+)/);
                                const outputId = outputIdMatch ? parseInt(outputIdMatch[1]) : null;
                                const output = outputId ? outputs.find(o => o.id === outputId) : null;
                                return output?.delivery_employee || 'Não definido';
                              })()}
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Quem fez a recolha</label>
                            <Combobox 
                              value={returnEmployee}
                              onChange={setReturnEmployee}
                              options={employees.map(e => e.name)}
                              placeholder="Selecione ou escreva o nome..."
                              className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                              listId="edit-recolha-emp"
                            />
                            <p className="text-[10px] text-slate-400 mt-1 italic">Pode selecionar um funcionário existente ou escrever um novo nome.</p>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Artigo</label>
                          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <p className="font-bold text-slate-800">{movements.find(m => m.id === editingMovementId)?.article_description}</p>
                            <p className="text-xs text-slate-500">{movements.find(m => m.id === editingMovementId)?.article_code}</p>
                          </div>
                        </div>
                        {(() => {
                          const movement = movements.find(m => m.id === editingMovementId);
                          const outputIdMatch = movement?.observations?.match(/#(\d+)/);
                          const outputId = outputIdMatch ? parseInt(outputIdMatch[1]) : null;
                          const output = outputId ? outputs.find(o => o.id === outputId) : null;
                          const item = output?.items?.find(i => i.article_id === movement?.article_id);
                          
                          if (!item) return null;
                          
                          return (
                            <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                              <div className="text-center">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Entregue</p>
                                <p className="text-lg font-black text-red-500">{item.quantity_out}</p>
                              </div>
                              <div className="text-center border-x border-slate-200">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Recolhido</p>
                                <p className="text-lg font-black text-emerald-500">{item.quantity_in}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Pendente</p>
                                <p className="text-lg font-black text-slate-800">{item.quantity_out - item.quantity_in}</p>
                              </div>
                            </div>
                          );
                        })()}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade</label>
                          <input 
                            type="number" 
                            min="1"
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                            value={editingMovementData.quantity}
                            onChange={e => setEditingMovementData({...editingMovementData, quantity: parseInt(e.target.value) || 0})}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
                          <textarea 
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 h-24"
                            value={editingMovementData.observations}
                            onChange={e => setEditingMovementData({...editingMovementData, observations: e.target.value})}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div>
                          <label className="block text-lg font-bold text-emerald-600 mb-2">Selecionar Entrega para Recolha</label>
                          <select 
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 text-lg"
                            value={selectedOutputId}
                            onChange={e => {
                              const outId = e.target.value;
                              setSelectedOutputId(outId);
                              if (outId) {
                                const out = outputs.find(o => o.id === parseInt(outId));
                                if (out) {
                                  const initialReturns: Record<number, number> = {};
                                  out.items?.forEach(item => {
                                    initialReturns[item.article_id] = item.quantity_out - item.quantity_in;
                                  });
                                  setReturnItems(initialReturns);
                                  setReturnEmployee(out.delivery_employee || '');
                                }
                              } else {
                                setReturnItems({});
                                setReturnEmployee('');
                              }
                            }}
                          >
                            <option value="">Escolha uma entrega...</option>
                            {outputs.filter(o => o.items?.some(item => item.quantity_out > item.quantity_in)).map(out => (
                              <option key={out.id} value={out.id}>
                                #{out.id} - {out.client_name} ({out.location_name}) - {formatDateDisplay(out.created_at)}
                              </option>
                            ))}
                          </select>
                        </div>

                        {selectedOutputId && (
                          <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                                <p className="text-[10px] font-bold text-blue-400 uppercase mb-1">Funcionário de Entrega</p>
                                <p className="font-bold text-blue-700">
                                  {outputs.find(o => o.id === parseInt(selectedOutputId))?.delivery_employee || 'Não definido'}
                                </p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Quem fez a recolha</label>
                                <Combobox 
                                  value={returnEmployee}
                                  onChange={setReturnEmployee}
                                  options={employees.map(e => e.name)}
                                  placeholder="Selecione ou escreva o nome..."
                                  className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                                  listId="new-recolha-emp"
                                />
                                <p className="text-[10px] text-slate-400 mt-1 italic">Pode selecionar um funcionário existente ou escrever um novo nome.</p>
                              </div>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead>
                                  <tr className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                    <th className="pb-3 px-2">Artigo</th>
                                    <th className="pb-3 px-2 text-center">Qtd. Entrega</th>
                                    <th className="pb-3 px-2 text-center">Já Recolhido</th>
                                    <th className="pb-3 px-2 text-center w-32">A Recolher</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                  {outputs.find(o => o.id === parseInt(selectedOutputId))?.items?.map(item => {
                                    const remaining = item.quantity_out - item.quantity_in;
                                    return (
                                      <tr key={item.id} className="text-sm text-slate-600">
                                        <td className="py-4 px-2">
                                          <p className="font-semibold text-slate-800">{item.article_description}</p>
                                          <p className="text-xs text-slate-400">{item.article_code}</p>
                                        </td>
                                        <td className="py-4 px-2 text-center font-bold">{item.quantity_out}</td>
                                        <td className="py-4 px-2 text-center text-emerald-500 font-bold">{item.quantity_in}</td>
                                        <td className="py-4 px-2">
                                          <input 
                                            type="number" 
                                            min="0"
                                            max={remaining}
                                            className="w-full px-3 py-1 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 text-center"
                                            value={returnItems[item.article_id] || 0}
                                            onChange={e => setReturnItems({
                                              ...returnItems,
                                              [item.article_id]: Math.min(remaining, parseInt(e.target.value) || 0)
                                            })}
                                          />
                                          {remaining > 0 && (
                                            <p className="text-[10px] text-center text-slate-400 mt-1">Máx: {remaining}</p>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="p-6 border-t border-slate-50 bg-slate-50/50 flex justify-end gap-4 shrink-0">
                    <button 
                      type="button"
                      onClick={() => {
                        setShowInputForm(false);
                        setEditingMovementId(null);
                      }}
                      className="px-8 py-3 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={handleSaveReturn}
                      disabled={loading || (!editingMovementId && !selectedOutputId)}
                      className="px-10 py-3 bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-600 disabled:opacity-50 transition-all"
                    >
                      {loading ? 'A processar...' : editingMovementId ? 'ATUALIZAR RECOLHA' : 'GRAVAR RECOLHA'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col h-full space-y-6 overflow-hidden">
                  <div className="flex flex-col md:flex-row gap-4 shrink-0 items-start md:items-center">
                    <div className="relative flex-1 w-full">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                      <input 
                        type="text" 
                        placeholder="Pesquisar por cliente ou local..."
                        className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 bg-white shadow-sm"
                        value={inputSearch}
                        onFocus={() => setInputSearch('')}
                        onChange={e => setInputSearch(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                      <button 
                        onClick={() => setInputTodayOnly(!inputTodayOnly)}
                        className={`px-4 py-2 rounded-2xl text-sm font-medium transition-all border shadow-sm flex items-center gap-2 ${
                          inputTodayOnly 
                            ? 'bg-amber-500 text-white border-amber-500' 
                            : 'bg-white text-slate-600 border-slate-100 hover:bg-slate-50'
                        }`}
                      >
                        <Clock size={16} />
                        Hoje
                      </button>
                      <div className={`flex items-center gap-2 transition-opacity ${inputTodayOnly ? 'opacity-50 pointer-events-none' : ''}`}>
                        <span className="text-sm font-medium text-slate-500 whitespace-nowrap">Desde:</span>
                        <input 
                          type="date" 
                          className="px-4 py-2 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                          value={inputStartDate}
                          onChange={e => setInputStartDate(e.target.value)}
                        />
                      </div>

                      <div className="flex gap-2">
                        <button 
                          onClick={() => setInputStatusFilter('ACTIVE')}
                          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                            inputStatusFilter === 'ACTIVE' 
                              ? 'bg-emerald-500 text-white shadow-md' 
                              : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-50'
                          }`}
                        >
                          Não Recolhidas
                        </button>
                        <button 
                          onClick={() => setInputStatusFilter('COMPLETED')}
                          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                            inputStatusFilter === 'COMPLETED' 
                              ? 'bg-emerald-500 text-white shadow-md' 
                              : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-50'
                          }`}
                        >
                          Recolhidas
                        </button>
                        <button 
                          onClick={() => setInputStatusFilter('ALL')}
                          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                            inputStatusFilter === 'ALL' 
                              ? 'bg-emerald-500 text-white shadow-md' 
                              : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-50'
                          }`}
                        >
                          Todas
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                    {(() => {
                      const activeOutputs = outputs.filter(o => {
                        const isSettled = o.items?.every(item => item.quantity_out === item.quantity_in);
                        const isActive = !isSettled;
                        const matchesSearch = (o.client_name?.toLowerCase() || '').includes(inputSearch.toLowerCase()) || 
                                            o.location_name?.toLowerCase().includes(inputSearch.toLowerCase());
                        
                        const today = new Date().toISOString().split('T')[0];
                        const matchesDate = inputTodayOnly 
                          ? (o.collection_date && o.collection_date.split('T')[0] === today)
                          : (!inputStartDate || (o.collection_date && o.collection_date >= inputStartDate));
                        
                        return isActive && matchesSearch && matchesDate;
                      }).map(o => ({ ...o, listType: 'ACTIVE' as const }));

                      const completedMovementsGrouped: Record<number, any> = {};
                      movements.forEach(m => {
                        if (m.type !== 'IN' || !m.observations?.includes('Recolha')) return;
                        const outputIdMatch = m.observations?.match(/#(\d+)/);
                        const outputId = outputIdMatch ? parseInt(outputIdMatch[1]) : null;
                        if (!outputId) return;
                        
                        const relatedOutput = outputs.find(o => o.id === outputId);
                        const matchesSearch = ((relatedOutput?.client_name?.toLowerCase() || '').includes(inputSearch.toLowerCase()) || 
                                             relatedOutput?.location_name?.toLowerCase().includes(inputSearch.toLowerCase()) ||
                                             (m.article_description?.toLowerCase().includes(inputSearch.toLowerCase()) || false));
                        
                        const today = new Date().toISOString().split('T')[0];
                        const matchesDate = inputTodayOnly 
                          ? (m.date && m.date.split('T')[0] === today)
                          : (!inputStartDate || (m.date && m.date >= inputStartDate));
                        
                        if (matchesSearch && matchesDate) {
                          if (!completedMovementsGrouped[outputId]) {
                            completedMovementsGrouped[outputId] = {
                              id: outputId,
                              listType: 'COMPLETED',
                              relatedOutput,
                              movements: [],
                              date: m.date
                            };
                          }
                          completedMovementsGrouped[outputId].movements.push(m);
                          if (m.date > completedMovementsGrouped[outputId].date) {
                            completedMovementsGrouped[outputId].date = m.date;
                          }
                        }
                      });
                      const completedMovements = Object.values(completedMovementsGrouped);

                      let displayList: any[] = [];
                      if (inputStatusFilter === 'ACTIVE') displayList = activeOutputs;
                      else if (inputStatusFilter === 'COMPLETED') displayList = completedMovements;
                      else displayList = [...activeOutputs, ...completedMovements];

                      return displayList
                        .sort((a, b) => {
                          const dateA = a.listType === 'ACTIVE' ? (a.collection_date || '0') : a.date;
                          const dateB = b.listType === 'ACTIVE' ? (b.collection_date || '0') : b.date;
                          return dateA.localeCompare(dateB); // Oldest to newest
                        })
                        .map(item => {
                          if (item.listType === 'ACTIVE') {
                            const output = item;
                            const isExpanded = expandedOutputs[output.id];

                            return (
                              <div key={`active-${output.id}`} className="bg-white rounded-3xl border border-slate-100 shadow-lg hover:shadow-xl transition-all overflow-hidden">
                                <div className="p-6">
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                          output.type === 'ALUGUER' ? 'bg-blue-100 text-blue-600' :
                                          output.type === 'SERVIÇO' ? 'bg-emerald-100 text-emerald-600' :
                                          output.type === 'REPARAÇÃO' ? 'bg-orange-100 text-orange-600' :
                                          'bg-slate-100 text-slate-600'
                                        }`}>
                                          {output.type}
                                        </span>
                                        <span className="text-xs text-slate-400 font-medium">#{output.id}</span>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-500 border border-emerald-100">
                                          NÃO RECOLHIDA
                                        </span>
                                      </div>
                                      <h3 className="text-lg font-bold text-slate-800">{output.client_name}</h3>
                                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                        <p className="text-sm text-slate-500 flex items-center gap-1">
                                          <MapPin size={14} className="text-slate-400" />
                                          {output.location_name} {output.space_at_location && `(${output.space_at_location})`}
                                        </p>
                                        {output.client_contact && (
                                          <p className="text-sm text-slate-500 flex items-center gap-1">
                                            <Phone size={14} className="text-slate-400" />
                                            {output.client_contact}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                      {can('create') && (
                                        <button 
                                          onClick={() => {
                                            setSelectedOutputId(output.id.toString());
                                            setReturnEmployee(output.collection_employee || '');
                                            const initialReturns: Record<number, number> = {};
                                            output.items?.forEach((item: any) => {
                                              initialReturns[item.article_id] = item.quantity_out - item.quantity_in;
                                            });
                                            setReturnItems(initialReturns);
                                            setShowInputForm(true);
                                          }}
                                          className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-md hover:bg-emerald-600 transition-all"
                                        >
                                          Nova Recolha
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-slate-400">
                                    <div>
                                      <p className="uppercase tracking-wider font-semibold mb-1">Entrega</p>
                                      <div className="flex flex-col gap-2">
                                        <p className="text-slate-600 font-medium flex items-baseline gap-2">
                                          {formatDateDisplay(output.delivery_date)}
                                          {output.delivery_date && <span className="text-[10px] opacity-70 whitespace-nowrap">{formatTimeDisplay(output.delivery_date)}</span>}
                                        </p>
                                        <Combobox 
                                          value={output.delivery_employee || ''}
                                          onChange={(val) => handleUpdateOutputEmployee(output.id, { delivery_employee: val })}
                                          options={employees.map(e => e.name)}
                                          placeholder="Funcionário..."
                                          className="text-[10px] font-bold px-2 py-1 rounded-lg border outline-none transition-all bg-slate-50 text-slate-600 border-slate-200 w-full"
                                          listId={`recolhas-delivery-emp-${output.id}`}
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <p className="uppercase tracking-wider font-semibold mb-1">Montagem</p>
                                      <p className="text-slate-600 font-medium flex items-baseline gap-2">
                                        {formatDateDisplay(output.assembly_date)}
                                        {output.assembly_date && <span className="text-[10px] opacity-70 whitespace-nowrap">{formatTimeDisplay(output.assembly_date)}</span>}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="uppercase tracking-wider font-semibold mb-1 text-emerald-500">Recolha</p>
                                      <div className="flex flex-col gap-2">
                                        <p className="text-emerald-600 font-bold flex items-baseline gap-2">
                                          {formatDateDisplay(output.collection_date)}
                                          {output.collection_date && <span className="text-[10px] opacity-70 whitespace-nowrap">{formatTimeDisplay(output.collection_date)}</span>}
                                        </p>
                                        <Combobox 
                                          value={output.collection_employee || ''}
                                          onChange={(val) => handleUpdateOutputEmployee(output.id, { collection_employee: val })}
                                          options={employees.map(e => e.name)}
                                          placeholder="Funcionário..."
                                          className="text-[10px] font-bold px-2 py-1 rounded-lg border outline-none transition-all bg-slate-50 text-slate-600 border-slate-200 w-full"
                                          listId={`recolhas-collection-emp-${output.id}`}
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <p className="uppercase tracking-wider font-semibold mb-1">Artigos</p>
                                      <p className="text-slate-600 font-medium">{output.items?.length || 0} Itens</p>
                                      <button 
                                        onClick={() => setExpandedOutputs({...expandedOutputs, [output.id]: !isExpanded})}
                                        className="flex items-center gap-1 text-emerald-600 font-bold hover:underline mt-1"
                                      >
                                        {isExpanded ? 'Ocultar' : 'Ver'}
                                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                      </button>
                                    </div>
                                  </div>

                                  <AnimatePresence>
                                    {isExpanded && (
                                      <motion.div 
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="mt-6 pt-6 border-t border-slate-50 overflow-hidden"
                                      >
                                        <div className="bg-slate-50 rounded-2xl p-4">
                                          <p className="text-xs font-bold text-slate-400 uppercase mb-3 tracking-widest">Artigos Pendentes</p>
                                          <div className="space-y-3">
                                            {output.items?.map((item: any) => (
                                              <div key={item.id} className="flex justify-between items-center text-sm">
                                                <div className="flex-1">
                                                  <span className="text-slate-700 font-medium block">{item.article_description}</span>
                                                  <span className="text-[10px] text-slate-400 font-mono">{item.article_code}</span>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                  <div className="text-center">
                                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Entrega</p>
                                                    <p className="text-red-500 font-bold">{item.quantity_out}</p>
                                                  </div>
                                                  <div className="text-center">
                                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Recolha</p>
                                                    <p className="text-emerald-500 font-bold">{item.quantity_in}</p>
                                                  </div>
                                                  <div className="text-center bg-white px-3 py-1 rounded-lg border border-slate-100">
                                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Pendente</p>
                                                    <p className="text-slate-800 font-extrabold">{item.quantity_out - item.quantity_in}</p>
                                                  </div>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              </div>
                            );
                           } else {
                            const group = item;
                            const output = group.relatedOutput;
                            const isExpanded = expandedOutputs[output?.id || 0];

                            return (
                              <div key={`completed-${group.id}`} className="bg-white rounded-3xl border border-slate-100 shadow-lg hover:shadow-xl transition-all overflow-hidden border-l-4 border-l-emerald-500">
                                <div className="p-6">
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                          output?.type === 'ALUGUER' ? 'bg-blue-100 text-blue-600' :
                                          output?.type === 'SERVIÇO' ? 'bg-emerald-100 text-emerald-600' :
                                          output?.type === 'REPARAÇÃO' ? 'bg-orange-100 text-orange-600' :
                                          'bg-slate-100 text-slate-600'
                                        }`}>
                                          {output?.type || 'N/A'}
                                        </span>
                                        <span className="text-xs text-slate-400 font-medium">#{output?.id || 'N/A'}</span>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-500 border border-blue-100">
                                          RECOLHIDA
                                        </span>
                                      </div>
                                      <h3 className="text-lg font-bold text-slate-800">{output?.client_name || 'N/A'}</h3>
                                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                        <p className="text-sm text-slate-500 flex items-center gap-1">
                                          <MapPin size={14} className="text-slate-400" />
                                          {output?.location_name} {output?.space_at_location && `(${output?.space_at_location})`}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-slate-400">
                                    <div>
                                      <p className="uppercase tracking-wider font-semibold mb-1">Entrega</p>
                                      <div className="flex flex-col gap-2">
                                        <p className="text-slate-600 font-medium flex items-baseline gap-2">
                                          {formatDateDisplay(output?.delivery_date)}
                                          {output?.delivery_date && <span className="text-[10px] opacity-70 whitespace-nowrap">{formatTimeDisplay(output.delivery_date)}</span>}
                                        </p>
                                        {output && (
                                          <Combobox 
                                            value={output.delivery_employee || ''}
                                            onChange={(val) => handleUpdateOutputEmployee(output.id, { delivery_employee: val })}
                                            options={employees.map(e => e.name)}
                                            placeholder="Funcionário..."
                                            className="text-[10px] font-bold px-2 py-1 rounded-lg border outline-none transition-all bg-slate-50 text-slate-600 border-slate-200 w-full"
                                            listId={`completed-delivery-emp-${output.id}`}
                                          />
                                        )}
                                      </div>
                                    </div>
                                    <div>
                                      <p className="uppercase tracking-wider font-semibold mb-1">Montagem</p>
                                      <p className="text-slate-600 font-medium flex items-baseline gap-2">
                                        {formatDateDisplay(output?.assembly_date)}
                                        {output?.assembly_date && <span className="text-[10px] opacity-70 whitespace-nowrap">{formatTimeDisplay(output.assembly_date)}</span>}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="uppercase tracking-wider font-semibold mb-1 text-emerald-500">Última Recolha</p>
                                      <div className="flex flex-col gap-2">
                                        <p className="text-emerald-600 font-bold">
                                          {formatDateDisplay(group.date)}
                                        </p>
                                        {output && (
                                          <Combobox 
                                            value={output.collection_employee || ''}
                                            onChange={(val) => handleUpdateOutputEmployee(output.id, { collection_employee: val })}
                                            options={employees.map(e => e.name)}
                                            placeholder="Funcionário..."
                                            className="text-[10px] font-bold px-2 py-1 rounded-lg border outline-none transition-all bg-slate-50 text-slate-600 border-slate-200 w-full"
                                            listId={`completed-collection-emp-${output.id}`}
                                          />
                                        )}
                                      </div>
                                    </div>
                                    <div>
                                      <p className="uppercase tracking-wider font-semibold mb-1">Artigos</p>
                                      <p className="text-slate-600 font-medium">{output?.items?.length || 0} Itens</p>
                                      <button 
                                        onClick={() => setExpandedOutputs({...expandedOutputs, [output?.id || 0]: !isExpanded})}
                                        className="flex items-center gap-1 text-emerald-600 font-bold hover:underline text-xs mt-1"
                                      >
                                        {isExpanded ? 'Ocultar Detalhes' : 'Ver Detalhes'}
                                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                      </button>
                                    </div>
                                  </div>

                                  <AnimatePresence>
                                    {isExpanded && (
                                      <motion.div 
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="mt-4 pt-4 border-t border-slate-50 overflow-hidden"
                                      >
                                        <div className="space-y-3">
                                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Artigos Recolhidos</p>
                                          {group.movements.map((m: any) => (
                                            <div key={m.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                              <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-800 truncate">{m.article_description}</p>
                                                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                                  <span>{m.article_code}</span>
                                                  <span>•</span>
                                                  <span>{formatFullDateTime(m.date)}</span>
                                                </div>
                                              </div>
                                              <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                  <p className="text-sm font-black text-emerald-600">{m.quantity}</p>
                                                  <p className="text-[8px] text-slate-400 uppercase font-bold">Recolhido</p>
                                                </div>
                                                <div className="flex gap-1">
                                                  {can('edit') && (
                                                    <button 
                                                      onClick={() => {
                                                        const outputIdMatch = m.observations?.match(/#(\d+)/);
                                                        const outputId = outputIdMatch ? parseInt(outputIdMatch[1]) : null;
                                                        const output = outputId ? outputs.find(o => o.id === outputId) : null;
                                                        setReturnEmployee(output?.collection_employee || '');
                                                        setEditingMovementId(m.id);
                                                        setEditingMovementData({
                                                          quantity: m.quantity,
                                                          observations: m.observations || ''
                                                        });
                                                        setShowInputForm(true);
                                                      }}
                                                      className="p-2 text-slate-400 hover:text-indigo-500 transition-colors bg-white rounded-xl border border-slate-100 shadow-sm"
                                                      title="Editar"
                                                    >
                                                      <Edit size={14} />
                                                    </button>
                                                  )}
                                                  {can('delete') && (
                                                    <button 
                                                      onClick={() => handleDeleteMovement(m.id)}
                                                      className="p-2 text-slate-400 hover:text-red-500 transition-colors bg-white rounded-xl border border-slate-100 shadow-sm"
                                                      title="Eliminar"
                                                    >
                                                      <Trash2 size={14} />
                                                    </button>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              </div>
                            );
                           }
                        })
                    })()}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {view === 'outputs' && (
            <motion.div
              key="outputs"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col flex-1 min-h-0 space-y-6"
            >
              <div className="flex items-center justify-between shrink-0">
                <h2 className="text-2xl font-bold text-slate-800">
                  {showOutputForm ? (editingOutputId ? 'Editar Entrega' : 'Nova Entrega') : 'Entregas'}
                </h2>
                <div className="flex gap-2">
                  {can('create') && (
                    <button 
                      onClick={() => {
                        setShowOutputForm(!showOutputForm);
                        if (!showOutputForm) {
                          setEditingOutputId(null);
                          setOutputForm({ type: 'ALUGUER', with_assembly: false, items: [] });
                        }
                      }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                        showOutputForm 
                          ? 'bg-slate-100 text-slate-600' 
                          : 'a2r-gradient text-white shadow-lg shadow-blue-100'
                      }`}
                    >
                      {showOutputForm ? <X size={18} /> : <Plus size={18} />}
                      {showOutputForm ? 'Cancelar' : 'Nova Entrega'}
                    </button>
                  )}
                  {!showOutputForm && (
                    <button 
                      onClick={() => setView('menu')}
                      className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X size={24} />
                    </button>
                  )}
                </div>
              </div>

              {showOutputForm ? (
                <div className="flex flex-col h-full bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
                  <form onSubmit={handleSaveOutput} className="flex flex-col h-full overflow-hidden">
                    {/* Tabs */}
                    <div className="flex border-b border-slate-100 shrink-0">
                      <button
                        type="button"
                        onClick={() => setOutputFormTab('info')}
                        className={`flex-1 py-5 text-center font-bold transition-all border-b-4 ${
                          outputFormTab === 'info' 
                            ? 'border-a2r-blue-dark text-a2r-blue-dark bg-blue-50/30 text-xl' 
                            : 'border-transparent text-slate-400 hover:text-slate-600 text-lg'
                        }`}
                      >
                        Informação Geral
                      </button>
                      <button
                        type="button"
                        onClick={() => setOutputFormTab('items')}
                        className={`flex-1 py-5 text-center font-bold transition-all border-b-4 ${
                          outputFormTab === 'items' 
                            ? 'border-a2r-blue-dark text-a2r-blue-dark bg-blue-50/30 text-xl' 
                            : 'border-transparent text-slate-400 hover:text-slate-600 text-lg'
                        }`}
                      >
                        Artigos da Entrega ({outputForm.items?.length || 0})
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                      {outputFormTab === 'info' ? (
                        <div className="space-y-8">
                          {/* Section 1: General Info */}
                          <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Entrega</label>
                                <select 
                                  className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light"
                                  value={outputForm.type}
                                  onChange={e => setOutputForm({...outputForm, type: e.target.value as OutputType})}
                                >
                                  <option value="ALUGUER">ALUGUER</option>
                                  <option value="SERVIÇO">SERVIÇO</option>
                                  <option value="EMPRÉSTIMO">EMPRÉSTIMO</option>
                                  <option value="REPARAÇÃO">REPARAÇÃO</option>
                                  <option value="ESTRAGADO">ESTRAGADO</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Cliente</label>
                                <input 
                                  type="text" 
                                  required
                                  className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light"
                                  value={outputForm.client_name || ''}
                                  onChange={e => setOutputForm({...outputForm, client_name: e.target.value})}
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Contacto</label>
                                <input 
                                  type="text" 
                                  className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light"
                                  value={outputForm.client_contact || ''}
                                  onChange={e => setOutputForm({...outputForm, client_contact: e.target.value})}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              <div>
                                <div className="flex justify-between items-center mb-1">
                                  <label className="block text-sm font-medium text-slate-700">Data/Hora Entrega</label>
                                  <button 
                                    type="button"
                                    onClick={() => setOutputForm({...outputForm, delivery_date: outputForm.delivery_date === UNDEFINED_DATE ? '' : UNDEFINED_DATE})}
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-lg transition-colors ${outputForm.delivery_date === UNDEFINED_DATE ? 'bg-a2r-blue-dark text-white' : 'text-a2r-blue-dark bg-blue-50 hover:bg-blue-100'}`}
                                  >
                                    Não definido
                                  </button>
                                </div>
                                <input 
                                  type={outputForm.delivery_date === UNDEFINED_DATE ? "text" : "datetime-local"} 
                                  className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light"
                                  value={outputForm.delivery_date === UNDEFINED_DATE ? "Não definido" : (outputForm.delivery_date || '')}
                                  onFocus={() => {
                                    if (outputForm.delivery_date === UNDEFINED_DATE) {
                                      setOutputForm({...outputForm, delivery_date: ''});
                                    }
                                  }}
                                  onChange={e => setOutputForm({...outputForm, delivery_date: e.target.value})}
                                />
                              </div>
                              <div>
                                <div className="flex justify-between items-center mb-1">
                                  <label className="block text-sm font-medium text-slate-700">Data/Hora Montagem</label>
                                  <button 
                                    type="button"
                                    onClick={() => setOutputForm({...outputForm, assembly_date: outputForm.assembly_date === UNDEFINED_DATE ? '' : UNDEFINED_DATE})}
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-lg transition-colors ${outputForm.assembly_date === UNDEFINED_DATE ? 'bg-a2r-blue-dark text-white' : 'text-a2r-blue-dark bg-blue-50 hover:bg-blue-100'}`}
                                  >
                                    Não definido
                                  </button>
                                </div>
                                <input 
                                  type={outputForm.assembly_date === UNDEFINED_DATE ? "text" : "datetime-local"}
                                  className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light"
                                  value={outputForm.assembly_date === UNDEFINED_DATE ? "Não definido" : (outputForm.assembly_date || '')}
                                  onFocus={() => {
                                    if (outputForm.assembly_date === UNDEFINED_DATE) {
                                      setOutputForm({...outputForm, assembly_date: ''});
                                    }
                                  }}
                                  onChange={e => setOutputForm({...outputForm, assembly_date: e.target.value})}
                                />
                              </div>
                              <div>
                                <div className="flex justify-between items-center mb-1">
                                  <label className="block text-sm font-medium text-slate-700">Data/Hora Recolha</label>
                                  <button 
                                    type="button"
                                    onClick={() => setOutputForm({...outputForm, collection_date: outputForm.collection_date === UNDEFINED_DATE ? '' : UNDEFINED_DATE})}
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-lg transition-colors ${outputForm.collection_date === UNDEFINED_DATE ? 'bg-a2r-blue-dark text-white' : 'text-a2r-blue-dark bg-blue-50 hover:bg-blue-100'}`}
                                  >
                                    Não definido
                                  </button>
                                </div>
                                <input 
                                  type={outputForm.collection_date === UNDEFINED_DATE ? "text" : "datetime-local"}
                                  className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light"
                                  value={outputForm.collection_date === UNDEFINED_DATE ? "Não definido" : (outputForm.collection_date || '')}
                                  onFocus={() => {
                                    if (outputForm.collection_date === UNDEFINED_DATE) {
                                      setOutputForm({...outputForm, collection_date: ''});
                                    }
                                  }}
                                  onChange={e => setOutputForm({...outputForm, collection_date: e.target.value})}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Local</label>
                                <input 
                                  type="text" 
                                  list="locations-list"
                                  required
                                  className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light"
                                  value={outputForm.location_name || ''}
                                  onChange={e => setOutputForm({...outputForm, location_name: e.target.value})}
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Espaço no Local</label>
                                <input 
                                  type="text" 
                                  className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light"
                                  value={outputForm.space_at_location || ''}
                                  onChange={e => setOutputForm({...outputForm, space_at_location: e.target.value})}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Quem vai fazer entrega</label>
                                <Combobox 
                                  value={outputForm.delivery_employee || ''}
                                  onChange={val => setOutputForm({...outputForm, delivery_employee: val})}
                                  options={employees.map(e => e.name)}
                                  placeholder="Selecione ou escreva o nome..."
                                  className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light"
                                  listId="delivery-emp"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Quem vai fazer recolha</label>
                                <Combobox 
                                  value={outputForm.collection_employee || ''}
                                  onChange={val => setOutputForm({...outputForm, collection_employee: val})}
                                  options={employees.map(e => e.name)}
                                  placeholder="Selecione ou escreva o nome..."
                                  className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light"
                                  listId="collection-emp"
                                />
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <input 
                                type="checkbox" 
                                id="with_assembly"
                                className="w-5 h-5 rounded border-slate-300 text-a2r-blue-dark focus:ring-a2r-blue-light"
                                checked={outputForm.with_assembly || false}
                                onChange={e => setOutputForm({...outputForm, with_assembly: e.target.checked})}
                              />
                              <label htmlFor="with_assembly" className="text-sm font-medium text-slate-700">Com Montagem?</label>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
                              <textarea 
                                className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light h-24"
                                value={outputForm.observations || ''}
                                onChange={e => setOutputForm({...outputForm, observations: e.target.value})}
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-8">
                          {/* Section 2: Items */}
                          <div className="space-y-6">
                            <div className="flex flex-col md:flex-row gap-4 items-end bg-slate-50 p-6 rounded-2xl border border-slate-100">
                              <div className="flex-1 w-full relative">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Artigo (Código ou Descrição)</label>
                                <div className="flex gap-2">
                                  <div className="relative flex-1">
                                    <input 
                                      ref={articleCodeInputRef}
                                      type="text" 
                                      className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light"
                                      placeholder="Digite para pesquisar..."
                                      value={articleSearchQuery}
                                      onFocus={() => setArticleSearchQuery('')}
                                      onChange={e => {
                                        setArticleSearchQuery(e.target.value);
                                        // If user types something that matches exactly a code, select it
                                        const exactMatch = articles.find(a => (a.code?.toLowerCase() || '') === e.target.value.toLowerCase());
                                        if (exactMatch) {
                                          setSelectedArticleId(exactMatch.id.toString());
                                          setArticleSearchQuery(exactMatch.description);
                                        }
                                      }}
                                    />
                                    {articleSearchQuery && !selectedArticleId && (
                                      <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                                        {articles
                                          .filter(a => 
                                            (a.code?.toLowerCase() || '').includes(articleSearchQuery.toLowerCase()) || 
                                            (a.description?.toLowerCase() || '').includes(articleSearchQuery.toLowerCase())
                                          )
                                          .map(art => (
                                            <button
                                              key={art.id}
                                              type="button"
                                              onClick={() => {
                                                setSelectedArticleId(art.id.toString());
                                                setArticleSearchQuery(art.description);
                                              }}
                                              disabled={art.available_stock <= 0}
                                              className="w-full px-4 py-2 text-left hover:bg-slate-50 flex justify-between items-center border-b border-slate-50 last:border-0 disabled:opacity-50"
                                            >
                                              <div>
                                                <p className="font-bold text-slate-800">{art.code}</p>
                                                <p className="text-xs text-slate-500">{art.description}</p>
                                              </div>
                                              <span className={`text-xs font-bold ${art.available_stock > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                Stock: {art.available_stock}
                                              </span>
                                            </button>
                                          ))}
                                      </div>
                                    )}
                                    {selectedArticleId && (
                                      <button 
                                        type="button"
                                        onClick={() => {
                                          setSelectedArticleId('');
                                          setArticleSearchQuery('');
                                        }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500"
                                      >
                                        <X size={16} />
                                      </button>
                                    )}
                                  </div>
                                  <button 
                                    type="button"
                                    onClick={() => setShowArticleSearchModal(true)}
                                    className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-a2r-blue-dark hover:border-a2r-blue-dark transition-all"
                                    title="Pesquisa Avançada"
                                  >
                                    <Search size={20} />
                                  </button>
                                </div>
                              </div>
                              <div className="w-full md:w-32">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Qtd. Entrega</label>
                                <input 
                                  type="number" 
                                  min="1"
                                  className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light"
                                  value={selectedQuantity}
                                  onFocus={(e) => e.target.select()}
                                  onChange={e => {
                                    const val = parseInt(e.target.value);
                                    if (isNaN(val) || val < 1) {
                                      setSelectedQuantity(1);
                                    } else {
                                      setSelectedQuantity(val);
                                    }
                                  }}
                                />
                              </div>
                              <button 
                                type="button"
                                onClick={addItemToOutput}
                                className="px-6 py-2 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-700 transition-colors flex items-center gap-2"
                              >
                                <Plus size={18} />
                                Adicionar
                              </button>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead>
                                  <tr className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                    <th className="pb-3 px-2">Artigo</th>
                                    <th className="pb-3 px-2 text-center">Qtd. Entrega</th>
                                    <th className="pb-3 px-2 text-center">Qtd. Recolha</th>
                                    <th className="pb-3 px-2 text-right">Ações</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                  {outputForm.items?.length === 0 ? (
                                    <tr>
                                      <td colSpan={4} className="py-8 text-center text-slate-400 italic">
                                        Nenhum artigo adicionado.
                                      </td>
                                    </tr>
                                  ) : (
                                    outputForm.items?.map((item, idx) => (
                                      <tr key={idx} className="text-sm text-slate-600">
                                        <td className="py-4 px-2">
                                          <p className="font-semibold text-slate-800">{item.article_description}</p>
                                          <p className="text-xs text-slate-400">{item.article_code}</p>
                                        </td>
                                        <td className="py-4 px-2 text-center">
                                          <input 
                                            type="number"
                                            min="1"
                                            className="w-20 px-2 py-1 rounded-lg border border-slate-200 text-center font-bold text-red-500 focus:ring-2 focus:ring-a2r-blue-light outline-none"
                                            value={item.quantity_out}
                                            onFocus={(e) => e.target.select()}
                                            onChange={(e) => {
                                              const val = parseInt(e.target.value);
                                              if (isNaN(val) || val < 1) {
                                                return;
                                              }
                                              if (val < (item.quantity_in || 0)) {
                                                showToast(`A quantidade de entrega não pode ser inferior à quantidade já recolhida (${item.quantity_in}).`, 'error');
                                                return;
                                              }
                                              const newItems = [...(outputForm.items || [])];
                                              newItems[idx].quantity_out = val;
                                              setOutputForm({ ...outputForm, items: newItems });
                                            }}
                                          />
                                        </td>
                                        <td className="py-4 px-2 text-center text-slate-400">
                                          {item.quantity_in || 0}
                                        </td>
                                        <td className="py-4 px-2 text-right">
                                          <button 
                                            type="button"
                                            onClick={() => {
                                              if ((item.quantity_in || 0) > 0) {
                                                showToast('Não pode eliminar um artigo que já tem recolhas.', 'error');
                                                return;
                                              }
                                              setConfirmModal({
                                                message: 'Tem a certeza que deseja eliminar este artigo da entrega?',
                                                onConfirm: () => removeItemFromOutput(item.article_id)
                                              });
                                            }}
                                            className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                                          >
                                            <Trash2 size={18} />
                                          </button>
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="p-6 border-t border-slate-50 bg-slate-50/50 flex justify-end gap-4 shrink-0">
                      <button 
                        type="button"
                        onClick={() => setShowOutputForm(false)}
                        className="px-8 py-3 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50"
                      >
                        Cancelar
                      </button>
                      <button 
                        type="submit"
                        disabled={loading || !outputForm.items?.length}
                        className="px-12 py-3 rounded-xl a2r-gradient text-white font-bold shadow-lg shadow-blue-200 hover:opacity-90 disabled:opacity-50 transition-all"
                      >
                        {loading ? 'A processar...' : (editingOutputId ? 'ATUALIZAR ENTREGA' : 'REGISTAR ENTREGA')}
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="flex flex-col h-full space-y-6 overflow-hidden">
                  <div className="flex flex-col md:flex-row gap-4 shrink-0 items-start md:items-center">
                    <div className="relative flex-1 w-full">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="text" 
                        placeholder="Pesquisar por cliente ou local..."
                        className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light bg-white shadow-sm"
                        value={outputSearch}
                        onFocus={() => setOutputSearch('')}
                        onChange={e => setOutputSearch(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                      <button 
                        onClick={() => setOutputTodayOnly(!outputTodayOnly)}
                        className={`px-4 py-2 rounded-2xl text-sm font-medium transition-all border shadow-sm flex items-center gap-2 ${
                          outputTodayOnly 
                            ? 'bg-amber-500 text-white border-amber-500' 
                            : 'bg-white text-slate-600 border-slate-100 hover:bg-slate-50'
                        }`}
                      >
                        <Clock size={16} />
                        Hoje
                      </button>
                      <div className={`flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm transition-opacity ${outputTodayOnly ? 'opacity-50 pointer-events-none' : ''}`}>
                        <span className="text-sm font-medium text-slate-500 whitespace-nowrap">Desde:</span>
                        <input 
                          type="date" 
                          className="px-2 py-1 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-a2r-blue-light outline-none text-sm"
                          value={outputStartDate}
                          onChange={e => setOutputStartDate(e.target.value)}
                        />
                      </div>
                      <div className="flex bg-white p-1 rounded-2xl border border-slate-100 shadow-sm">
                        <button 
                          onClick={() => setOutputStatusFilter('ACTIVE')}
                          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${outputStatusFilter === 'ACTIVE' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                          Não Recolhidas
                        </button>
                        <button 
                          onClick={() => setOutputStatusFilter('SETTLED')}
                          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${outputStatusFilter === 'SETTLED' ? 'bg-blue-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                          Recolhidas
                        </button>
                        <button 
                          onClick={() => setOutputStatusFilter('ALL')}
                          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${outputStatusFilter === 'ALL' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                          Todas
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                    {outputs
                      .filter(o => {
                        const matchesSearch = (o.client_name?.toLowerCase() || '').includes(outputSearch.toLowerCase()) || 
                                            o.location_name?.toLowerCase().includes(outputSearch.toLowerCase());
                        
                        const today = new Date().toISOString().split('T')[0];
                        const matchesDate = outputTodayOnly 
                          ? (o.delivery_date && o.delivery_date.split('T')[0] === today)
                          : (!outputStartDate || (o.delivery_date && o.delivery_date >= outputStartDate));
                        
                        const isSettled = o.items?.every(item => item.quantity_out === item.quantity_in);
                        const isActive = !isSettled;

                        if (outputStatusFilter === 'ACTIVE') return matchesSearch && matchesDate && isActive;
                        if (outputStatusFilter === 'SETTLED') return matchesSearch && matchesDate && isSettled;
                        return matchesSearch && matchesDate;
                      })
                      .sort((a, b) => {
                        const dateA = a.delivery_date ? new Date(a.delivery_date).getTime() : 0;
                        const dateB = b.delivery_date ? new Date(b.delivery_date).getTime() : 0;
                        return dateB - dateA;
                      })
                      .map(output => {
                        const isSettled = output.items?.every(item => item.quantity_out === item.quantity_in);
                        const isExpanded = expandedOutputs[output.id];

                        return (
                          <div key={output.id} className="bg-white rounded-3xl border border-slate-100 shadow-lg hover:shadow-xl transition-all overflow-hidden">
                            <div className="p-4">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                      output.type === 'ALUGUER' ? 'bg-blue-100 text-blue-600' :
                                      output.type === 'SERVIÇO' ? 'bg-emerald-100 text-emerald-600' :
                                      output.type === 'REPARAÇÃO' ? 'bg-orange-100 text-orange-600' :
                                      'bg-slate-100 text-slate-600'
                                    }`}>
                                      {output.type}
                                    </span>
                                    <span className="text-xs text-slate-400 font-medium">#{output.id}</span>
                                    {isSettled ? (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-500 border border-blue-100">
                                        RECOLHIDA
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-500 border border-emerald-100">
                                        NÃO RECOLHIDA
                                      </span>
                                    )}
                                  </div>
                                  <h3 className="text-lg font-bold text-slate-800">{output.client_name}</h3>
                                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                    <p className="text-sm text-slate-500 flex items-center gap-1">
                                      <MapPin size={14} className="text-slate-400" />
                                      {output.location_name} {output.space_at_location && `(${output.space_at_location})`}
                                    </p>
                                    {output.client_contact && (
                                      <p className="text-sm text-slate-500 flex items-center gap-1">
                                        <Phone size={14} className="text-slate-400" />
                                        {output.client_contact}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button 
                                    onClick={() => handlePrintOutput(output)}
                                    className="p-2 text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"
                                    title="Imprimir PDF"
                                  >
                                    <Printer size={20} />
                                  </button>
                                  <button 
                                    onClick={() => handleMailtoOutput(output)}
                                    className="p-2 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-xl transition-all"
                                    title="Enviar por Email"
                                  >
                                    <Mail size={20} />
                                  </button>
                                  {can('edit') && (
                                    <button 
                                      onClick={() => {
                                        setEditingOutputId(output.id);
                                        setOutputForm({
                                          type: output.type,
                                          client_name: output.client_name,
                                          client_contact: output.client_contact,
                                          delivery_date: formatDateForInput(output.delivery_date),
                                          assembly_date: formatDateForInput(output.assembly_date),
                                          collection_date: formatDateForInput(output.collection_date),
                                          with_assembly: output.with_assembly,
                                          location_name: output.location_name,
                                          space_at_location: output.space_at_location,
                                          observations: output.observations,
                                          delivery_employee: output.delivery_employee,
                                          collection_employee: output.collection_employee,
                                          items: output.items
                                        });
                                        setShowOutputForm(true);
                                      }}
                                      className="p-2 text-slate-300 hover:text-a2r-blue-dark hover:bg-blue-50 rounded-xl transition-all"
                                      title="Editar"
                                    >
                                      <Edit size={20} />
                                    </button>
                                  )}
                                  {can('delete') && (
                                    <button 
                                      onClick={() => handleDeleteOutput(output.id)}
                                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                      title="Eliminar"
                                    >
                                      <Trash2 size={20} />
                                    </button>
                                  )}
                                </div>
                              </div>
                              
                              <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-slate-400">
                                <div>
                                  <p className="uppercase tracking-wider font-semibold mb-1">Entrega</p>
                                  <div className="flex flex-col gap-2">
                                    <p className="text-slate-600 font-medium flex items-baseline gap-2">
                                      {formatDateDisplay(output.delivery_date)}
                                      <span className="text-[10px] opacity-70 whitespace-nowrap">{formatTimeDisplay(output.delivery_date)}</span>
                                    </p>
                                    <Combobox 
                                      value={output.delivery_employee || ''}
                                      onChange={(val) => handleUpdateOutputEmployee(output.id, { delivery_employee: val })}
                                      options={employees.map(e => e.name)}
                                      placeholder="Funcionário..."
                                      className="text-[10px] font-bold px-2 py-1 rounded-lg border outline-none transition-all bg-slate-50 text-slate-600 border-slate-200 w-full"
                                      listId={`list-delivery-emp-${output.id}`}
                                    />
                                  </div>
                                </div>
                                <div>
                                  <p className="uppercase tracking-wider font-semibold mb-1">Montagem</p>
                                  <p className="text-slate-600 font-medium flex items-baseline gap-2">
                                    {formatDateDisplay(output.assembly_date)}
                                    <span className="text-[10px] opacity-70 whitespace-nowrap">{formatTimeDisplay(output.assembly_date)}</span>
                                  </p>
                                </div>
                                <div>
                                  <p className="uppercase tracking-wider font-semibold mb-1">Recolha</p>
                                  <div className="flex flex-col gap-2">
                                    <p className="text-slate-600 font-medium flex items-baseline gap-2">
                                      {formatDateDisplay(output.collection_date)}
                                      <span className="text-[10px] opacity-70 whitespace-nowrap">{formatTimeDisplay(output.collection_date)}</span>
                                    </p>
                                    <Combobox 
                                      value={output.collection_employee || ''}
                                      onChange={(val) => handleUpdateOutputEmployee(output.id, { collection_employee: val })}
                                      options={employees.map(e => e.name)}
                                      placeholder="Funcionário..."
                                      className="text-[10px] font-bold px-2 py-1 rounded-lg border outline-none transition-all bg-slate-50 text-slate-600 border-slate-200 w-full"
                                      listId={`list-collection-emp-${output.id}`}
                                    />
                                  </div>
                                </div>
                                <div>
                                  <p className="uppercase tracking-wider font-semibold mb-1">Artigos</p>
                                  <p className="text-slate-600 font-medium">{output.items?.length || 0} Itens</p>
                                  <button 
                                    onClick={() => setExpandedOutputs(prev => ({ ...prev, [output.id]: !prev[output.id] }))}
                                    className="flex items-center gap-1 text-a2r-blue-dark font-bold hover:underline mt-1"
                                  >
                                    {isExpanded ? 'Ocultar' : 'Ver'}
                                    {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                  </button>
                                </div>
                              </div>
                            </div>

                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="bg-slate-50 border-t border-slate-100"
                                >
                                  <div className="p-4 space-y-3">
                                    <div className="grid grid-cols-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">
                                      <div className="col-span-2">Artigo</div>
                                      <div className="text-center">Entrega</div>
                                      <div className="text-center">Recolha</div>
                                    </div>
                                    {output.items?.map(item => (
                                      <div key={item.id} className="grid grid-cols-4 items-center bg-white p-2 rounded-xl border border-slate-100 text-sm">
                                        <div className="col-span-2">
                                          <p className="font-bold text-slate-800">{item.article_description}</p>
                                          <p className="text-[10px] text-slate-400">{item.article_code}</p>
                                        </div>
                                        <div className="text-center font-bold text-red-500">{item.quantity_out}</div>
                                        <div className="text-center font-bold text-emerald-500">{item.quantity_in}</div>
                                      </div>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {view === 'add-article' && (
            <motion.div 
              key="add-article"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col h-full max-w-2xl mx-auto bg-white rounded-3xl p-8 border border-slate-100 shadow-xl overflow-hidden"
            >
              <h2 className="text-2xl font-bold mb-6 text-slate-800 shrink-0">Novo Artigo</h2>
              <form onSubmit={handleAddArticle} className="flex flex-col h-full overflow-hidden">
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Código</label>
                      <input 
                        type="text" 
                        required
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light"
                        value={newArticle.code || ''}
                        onChange={e => setNewArticle({...newArticle, code: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Stock Total</label>
                      <input 
                        type="number" 
                        disabled
                        className="w-full px-4 py-2 rounded-xl border border-slate-100 bg-slate-50 text-slate-500 cursor-not-allowed outline-none"
                        value={newArticle.total_stock ?? 0}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                    <input 
                      type="text" 
                      required
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light"
                      value={newArticle.description || ''}
                      onChange={e => setNewArticle({...newArticle, description: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-widest ml-1">Família / SubFamília</label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Combobox 
                          value={getCategoryDisplayName(newArticle.categoria_id)}
                          onChange={(val) => {
                            const cat = categories.find(c => getCategoryDisplayName(c.id) === val);
                            setNewArticle({...newArticle, categoria_id: cat ? cat.id : null});
                          }}
                          options={categories.map(c => getCategoryDisplayName(c.id))}
                          placeholder="Pesquisar Família..."
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light"
                          listId="new-article-category"
                          inputRef={newArticleCategoryRef}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCategoryPickerReturnView('add-article');
                          setCategorySearch('');
                          setView('category-picker');
                        }}
                        className="p-2 bg-slate-100 text-slate-500 rounded-xl hover:bg-a2r-blue-dark hover:text-white transition-all shadow-sm border border-slate-200"
                        title="Selecionar na Lista"
                      >
                        <Search size={20} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCategoriesReturnView('add-article');
                          setView('categories');
                        }}
                        className="p-2 bg-slate-100 text-slate-500 rounded-xl hover:bg-a2r-blue-dark hover:text-white transition-all shadow-sm border border-slate-200"
                        title="Gerir Famílias"
                      >
                        <Layers size={20} />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Altura (cm)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light"
                        value={newArticle.height || ''}
                        onChange={e => setNewArticle({...newArticle, height: parseFloat(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Largura (cm)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light"
                        value={newArticle.width || ''}
                        onChange={e => setNewArticle({...newArticle, width: parseFloat(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Compr. (cm)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light"
                        value={newArticle.length || ''}
                        onChange={e => setNewArticle({...newArticle, length: parseFloat(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Peso (kg)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light"
                        value={newArticle.weight || ''}
                        onChange={e => setNewArticle({...newArticle, weight: parseFloat(e.target.value)})}
                      />
                    </div>
                  </div>
                  <PhotoUpload 
                    onPhotoCapture={base64 => setNewArticle({...newArticle, photo: base64})}
                    currentPhoto={newArticle.photo}
                  />
                </div>
                <div className="flex gap-4 pt-6 shrink-0 border-t border-slate-50 mt-auto">
                  <button 
                    type="button"
                    onClick={() => setView('articles')}
                    className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3 rounded-xl a2r-gradient text-white font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {loading ? 'A guardar...' : 'Guardar Artigo'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {view === 'article-stock' && (
            <motion.div
              key="article-stock"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col flex-1 min-h-0 space-y-6"
            >
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setView('articles')}
                    className="p-2.5 bg-white text-slate-400 hover:text-slate-600 rounded-2xl transition-all border border-slate-100 shadow-sm"
                  >
                    <ChevronDown className="rotate-90" size={24} />
                  </button>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">Movimentos de Stock</h2>
                    {selectedStockArticle && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-1.5 py-0.5 bg-a2r-blue-dark/10 text-a2r-blue-dark rounded text-[10px] font-bold uppercase tracking-wider">
                          {selectedStockArticle.code}
                        </span>
                        <p className="text-sm text-slate-500 font-medium truncate max-w-[200px] md:max-w-md">
                          {selectedStockArticle.description}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={generateStockMovementsReport}
                    className="hidden md:flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all shadow-sm"
                  >
                    <FileText size={18} />
                    Relatório PDF
                  </button>
                  <button 
                    onClick={() => setView('menu')}
                    className="p-2.5 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4 shrink-0">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Filtrar por Tipo</label>
                  <div className="flex bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm">
                    {(['ALL', 'IN', 'OUT'] as const).map(type => (
                      <button
                        key={type}
                        onClick={() => setStockFilter(type)}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                          stockFilter === type 
                            ? type === 'ALL' ? 'bg-a2r-blue-dark text-white shadow-lg shadow-blue-200'
                            : type === 'IN' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200'
                            : 'bg-red-500 text-white shadow-lg shadow-red-200'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {type === 'ALL' ? 'Todos' : type === 'IN' ? 'Entradas' : 'Saídas'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="w-full md:w-56">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Desde a Data</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light text-sm font-medium bg-white shadow-sm"
                    value={stockStartDate}
                    onChange={e => setStockStartDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                {stockMovements
                  .filter(m => {
                    const matchesArticle = !selectedStockArticle || m.article_id === selectedStockArticle.id;
                    const matchesType = stockFilter === 'ALL' || m.type === stockFilter;
                    const matchesDate = m.date >= stockStartDate;
                    return matchesArticle && matchesType && matchesDate;
                  })
                  .map(movement => (
                    <div key={movement.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center justify-between gap-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          movement.type === 'IN' ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'
                        }`}>
                          {movement.type === 'IN' ? <PlusCircle size={20} /> : <MinusCircle size={20} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-400">{formatDateDisplay(movement.date)}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              movement.type === 'IN' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                            }`}>
                              {movement.type === 'IN' ? 'Entrada' : 'Saída'}
                            </span>
                            {movement.document_number && (
                              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                Doc: {movement.document_number}
                              </span>
                            )}
                          </div>
                          <p className="font-bold text-slate-800">{movement.article_description}</p>
                          {movement.observations && (
                            <p className="text-xs text-slate-500 mt-0.5 italic">"{movement.observations}"</p>
                          )}
                          <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                            <UserPlus size={10} /> {movement.user_name}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-black ${movement.type === 'IN' ? 'text-emerald-500' : 'text-red-500'}`}>
                          {movement.type === 'IN' ? '+' : '-'}{movement.quantity}
                        </p>
                        <div className="flex gap-1 justify-end">
                          {can('edit') && (
                            <button 
                              onClick={() => {
                                const article = articles.find(a => a.id === movement.article_id);
                                if (article) {
                                  setSelectedStockArticle(article);
                                  setEditingStockMovement(movement);
                                  setStockForm({
                                    type: movement.type,
                                    document_number: movement.document_number || '',
                                    date: movement.date.split('T')[0],
                                    quantity: movement.quantity,
                                    observations: movement.observations || ''
                                  });
                                  if (movement.type === 'IN') {
                                    setShowStockEntryForm(true);
                                  } else {
                                    setShowStockExitForm(true);
                                  }
                                }
                              }}
                              className="p-1.5 text-slate-300 hover:text-blue-500 transition-all"
                              title="Editar Movimento"
                            >
                              <Edit2 size={16} />
                            </button>
                          )}
                          {can('delete') && (
                            <button 
                              onClick={() => handleDeleteStockMovement(movement.id)}
                              className="p-1.5 text-slate-300 hover:text-red-500 transition-all"
                              title="Eliminar Movimento"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                
                {stockMovements.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <History size={48} className="mb-4 opacity-20" />
                    <p className="font-medium">Nenhum movimento encontrado</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {view === 'inventory-report' && (
            <motion.div
              key="inventory-report"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col flex-1 min-h-0 space-y-6"
            >
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setView('articles')}
                    className="p-2.5 bg-white text-slate-400 hover:text-slate-600 rounded-2xl transition-all border border-slate-100 shadow-sm"
                  >
                    <ChevronDown className="rotate-90" size={24} />
                  </button>
                  <h2 className="text-2xl font-bold text-slate-800">Relatório de Inventário</h2>
                </div>
                <button 
                  onClick={() => setView('menu')}
                  className="p-2.5 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl space-y-8 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {/* Ordering */}
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Ordenação por</label>
                    <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                      {(['code', 'description'] as const).map(order => (
                        <button
                          key={order}
                          onClick={() => {
                            setReportOrder(order);
                            initializeReportArticles(order);
                          }}
                          className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${
                            reportOrder === order 
                              ? 'bg-a2r-blue-dark text-white shadow-lg shadow-blue-200'
                              : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          {order === 'code' ? 'Código' : 'Descrição'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Start Article */}
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">
                      {reportOrder === 'code' ? 'Artigo Inicial (Código)' : 'Artigo Inicial (Descrição)'}
                    </label>
                    <button
                      onClick={() => {
                        setShowArticleSearchFor('start');
                        setShowArticleSearchModal(true);
                      }}
                      className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 hover:border-a2r-blue-dark hover:bg-white transition-all group"
                    >
                      {reportStartArticle ? (
                        <div className="flex items-center gap-3 text-left">
                          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-a2r-blue-dark shadow-sm">
                            <Package size={20} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">
                              {reportOrder === 'code' ? reportStartArticle.code : reportStartArticle.description}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {reportOrder === 'code' ? reportStartArticle.description : reportStartArticle.code}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm font-medium text-slate-400 italic">Selecionar...</span>
                      )}
                      <Search size={20} className="text-slate-300 group-hover:text-a2r-blue-dark" />
                    </button>
                  </div>

                  {/* End Article */}
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">
                      {reportOrder === 'code' ? 'Artigo Final (Código)' : 'Artigo Final (Descrição)'}
                    </label>
                    <button
                      onClick={() => {
                        setShowArticleSearchFor('end');
                        setShowArticleSearchModal(true);
                      }}
                      className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 hover:border-a2r-blue-dark hover:bg-white transition-all group"
                    >
                      {reportEndArticle ? (
                        <div className="flex items-center gap-3 text-left">
                          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-a2r-blue-dark shadow-sm">
                            <Package size={20} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">
                              {reportOrder === 'code' ? reportEndArticle.code : reportEndArticle.description}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {reportOrder === 'code' ? reportEndArticle.description : reportEndArticle.code}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm font-medium text-slate-400 italic">Selecionar...</span>
                      )}
                      <Search size={20} className="text-slate-300 group-hover:text-a2r-blue-dark" />
                    </button>
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Data de Início</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                      <input 
                        type="date" 
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-a2r-blue-light outline-none text-lg font-medium"
                        value={reportStartDate}
                        onChange={e => setReportStartDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Data de Fim</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                      <input 
                        type="date" 
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-a2r-blue-light outline-none text-lg font-medium"
                        value={reportEndDate}
                        onChange={e => setReportEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={generateInventoryReportPDF}
                    disabled={!reportStartArticle || !reportEndArticle}
                    className="w-full md:w-auto flex items-center justify-center gap-3 px-12 py-4 a2r-gradient text-white rounded-2xl font-bold shadow-xl shadow-blue-200 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 disabled:shadow-none"
                  >
                    <FileText size={24} />
                    Gerar Relatório de Inventário
                  </button>
                </div>

                <div className="bg-blue-50 rounded-3xl p-6 border border-blue-100 flex items-start gap-4">
                  <div className="p-2 bg-white rounded-xl text-a2r-blue-dark shadow-sm">
                    <AlertCircle size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-a2r-blue-dark mb-1">Informações do Relatório</h4>
                    <ul className="text-xs text-slate-600 space-y-1 list-disc ml-4">
                      <li><b>Stock Anterior:</b> Calculado até à Data de Início.</li>
                      <li><b>Movimentos:</b> Listagem detalhada entre as datas selecionadas.</li>
                      <li><b>Stock Final:</b> Posição de stock na Data de Fim.</li>
                      <li><b>Ordenação:</b> O relatório será gerado seguindo a ordem escolhida (Código ou Descrição).</li>
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'category-picker' && (
            <motion.div
              key="category-picker"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col flex-1 min-h-0 space-y-6"
            >
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => {
                      if (categoryPickerReturnView) setView(categoryPickerReturnView);
                      else setView('menu');
                    }}
                    className="p-2.5 bg-white text-slate-400 hover:text-slate-600 rounded-2xl transition-all border border-slate-100 shadow-sm"
                  >
                    <ChevronDown className="rotate-90" size={24} />
                  </button>
                  <h2 className="text-2xl font-bold text-slate-800">Selecionar Família</h2>
                </div>
                <button 
                  onClick={() => setView('menu')}
                  className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex flex-col md:flex-row gap-4 shrink-0">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Pesquisar por código ou nome..."
                    className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 bg-white focus:ring-2 focus:ring-a2r-blue-light outline-none"
                    value={categorySearch}
                    autoFocus
                    onChange={e => setCategorySearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                {categories
                  .filter(c => c.nivel === 1)
                  .filter(family => {
                    const s = categorySearch.toLowerCase();
                    const familyMatches = (family.nome?.toLowerCase() || '').includes(s) || 
                                         (family.codigo?.toLowerCase() || '').includes(s);
                    
                    const subfamiliesMatch = categories.some(sub => 
                      sub.parent_id === family.id && 
                      ((sub.nome?.toLowerCase() || '').includes(s) || 
                       (sub.codigo?.toLowerCase() || '').includes(s))
                    );
                    
                    return familyMatches || subfamiliesMatch;
                  })
                  .map(family => (
                    <div key={family.id} className="space-y-2">
                      <div 
                        onClick={() => {
                          if (categoryPickerReturnView === 'add-article') {
                            setNewArticle({...newArticle, categoria_id: family.id});
                          } else if (categoryPickerReturnView === 'edit-article' && editingArticle) {
                            setEditingArticle({...editingArticle, categoria_id: family.id});
                          }
                          setView(categoryPickerReturnView || 'menu');
                        }}
                        className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:shadow-md hover:border-a2r-blue-light/30 transition-all cursor-pointer flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded border border-slate-200 uppercase tracking-widest">
                            {family.codigo}
                          </span>
                          <span className="font-bold text-slate-800">{family.nome}</span>
                        </div>
                        <ChevronRight size={18} className="text-slate-300 group-hover:text-a2r-blue-dark transition-colors" />
                      </div>

                      <div className="ml-8 space-y-1.5 border-l-2 border-slate-100 pl-4">
                        {categories
                          .filter(c => c.parent_id === family.id)
                          .filter(sub => {
                            const s = categorySearch.toLowerCase();
                            const familyMatches = (family.nome?.toLowerCase() || '').includes(s) || 
                                                 (family.codigo?.toLowerCase() || '').includes(s);
                            const subMatches = (sub.nome?.toLowerCase() || '').includes(s) || 
                                              (sub.codigo?.toLowerCase() || '').includes(s);
                            return familyMatches || subMatches;
                          })
                          .map(sub => (
                            <div 
                              key={sub.id}
                              onClick={() => {
                                if (categoryPickerReturnView === 'add-article') {
                                  setNewArticle({...newArticle, categoria_id: sub.id});
                                } else if (categoryPickerReturnView === 'edit-article' && editingArticle) {
                                  setEditingArticle({...editingArticle, categoria_id: sub.id});
                                }
                                setView(categoryPickerReturnView || 'menu');
                              }}
                              className="bg-slate-50/50 rounded-xl p-3 border border-slate-100 hover:bg-white hover:shadow-sm hover:border-a2r-blue-light/20 transition-all cursor-pointer flex items-center justify-between group"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-[10px] font-mono text-slate-400">
                                  {sub.codigo}
                                </span>
                                <span className="text-sm font-medium text-slate-700">{family.nome} {sub.nome}</span>
                              </div>
                              <CheckCircle2 size={16} className="text-slate-200 group-hover:text-emerald-500 transition-colors" />
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                
                {categories.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <Layers size={48} className="mb-4 opacity-20" />
                    <p className="font-medium">Nenhuma categoria encontrada</p>
                  </div>
                )}
              </div>

              <div className="pt-2 shrink-0">
                <button
                  onClick={() => {
                    if (categoryPickerReturnView === 'add-article') {
                      setNewArticle({...newArticle, categoria_id: null});
                    } else if (categoryPickerReturnView === 'edit-article' && editingArticle) {
                      setEditingArticle({...editingArticle, categoria_id: null});
                    }
                    setView(categoryPickerReturnView || 'menu');
                  }}
                  className="w-full py-4 bg-white border-2 border-dashed border-slate-200 text-slate-500 rounded-2xl font-bold hover:bg-slate-50 hover:border-slate-300 transition-all"
                >
                  Limpar Seleção de Família
                </button>
              </div>
            </motion.div>
          )}

          {view === 'users-management' && (
            <motion.div
              key="users-management"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col flex-1 min-h-0 space-y-6"
            >
              <div className="flex items-center justify-between shrink-0">
                <h2 className="text-2xl font-bold text-slate-800">Gestão de Utilizadores</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setEditingUser(null);
                      setNewUser({ active: true });
                      setShowUserManagementForm(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 a2r-gradient text-white rounded-xl font-medium shadow-lg shadow-blue-200"
                  >
                    <Plus size={18} />
                    Novo Utilizador
                  </button>
                  <button 
                    onClick={() => setView('menu')}
                    className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4 shrink-0">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Pesquisar por nome ou email..."
                    className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 bg-white focus:ring-2 focus:ring-a2r-blue-light outline-none"
                    value={userManagementSearch}
                    onChange={e => setUserManagementSearch(e.target.value)}
                  />
                </div>
                <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
                  {(['all', 'active', 'inactive'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setUserStatusFilter(status)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all uppercase tracking-wider ${
                        userStatusFilter === status 
                          ? 'bg-white text-slate-800 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {status === 'all' ? 'Todos' : status === 'active' ? 'Ativos' : 'Desativos'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar pb-20">
                {users
                  .filter(u => {
                    const s = userManagementSearch.toLowerCase();
                    const matchesSearch = (u.name?.toLowerCase() || '').includes(s) || 
                                         (u.email?.toLowerCase() || '').includes(s);
                    
                    if (userStatusFilter === 'active') return matchesSearch && u.active;
                    if (userStatusFilter === 'inactive') return matchesSearch && !u.active;
                    return matchesSearch;
                  })
                  .map(u => (
                    <div key={u.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 overflow-hidden">
                          {u.photo ? (
                            <img src={u.photo} alt={u.name} className="w-full h-full object-cover" />
                          ) : (
                            <UserIcon size={24} />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-800">{u.name}</h3>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                              u.active ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'
                            }`}>
                              {u.active ? 'Ativo' : 'Desativo'}
                            </span>
                          </div>
                          <a 
                            href={`mailto:${u.email}`}
                            className="text-sm text-slate-500 hover:text-a2r-blue-dark hover:underline"
                          >
                            {u.email}
                          </a>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleToggleUserStatus(u)}
                          className={`p-2 rounded-xl transition-all ${
                            u.active ? 'text-slate-400 hover:text-amber-500 hover:bg-amber-50' : 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-50'
                          }`}
                          title={u.active ? 'Desativar' : 'Ativar'}
                        >
                          <RefreshCw size={20} className={!u.active ? 'rotate-180' : ''} />
                        </button>
                        <button 
                          onClick={() => {
                            setEditingUser(u);
                            setShowUserManagementForm(true);
                          }}
                          className="p-2 text-slate-400 hover:text-a2r-blue-dark hover:bg-blue-50 rounded-xl transition-all"
                          title="Editar"
                        >
                          <Edit size={20} />
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(u.id)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          title="Eliminar"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  ))}

                {users.length === 0 && (
                  <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                    <UserIcon size={48} className="mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500 font-medium">Nenhum utilizador encontrado.</p>
                  </div>
                )}
              </div>

              {/* User Form Modal */}
              {showUserManagementForm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
                  >
                    <div className="px-10 pt-10 pb-4 bg-white shrink-0 relative flex justify-between items-center">
                      <h2 className="text-3xl font-bold text-slate-800 font-display">
                        {editingUser ? 'Editar Utilizador' : 'Novo Utilizador'}
                      </h2>
                      <button 
                        onClick={() => setShowUserManagementForm(false)} 
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <X size={28} />
                      </button>
                    </div>
                    
                    <form onSubmit={handleUserSubmit} className="px-10 pb-10 space-y-3 overflow-y-auto custom-scrollbar">
                      {/* 1ª linha: Foto + Botoes */}
                      <div className="flex justify-center mb-2">
                        <PhotoUpload 
                          currentPhoto={editingUser ? editingUser.photo : (newUser.photo || null)}
                          onPhotoCapture={(photo) => {
                            if (editingUser) setEditingUser({...editingUser, photo});
                            else setNewUser({...newUser, photo});
                          }}
                          label=""
                        />
                      </div>

                      {/* 2ª linha: Nome Utilizador, Email */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Nome Utilizador</label>
                          <input 
                            type="text"
                            required
                            className="w-full px-5 py-3 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light font-medium text-lg"
                            value={editingUser ? editingUser.name : (newUser.name || '')}
                            onChange={e => {
                              if (editingUser) setEditingUser({...editingUser, name: e.target.value});
                              else setNewUser({...newUser, name: e.target.value});
                            }}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Email</label>
                          <input 
                            type="email"
                            required
                            className="w-full px-5 py-3 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light font-medium text-lg"
                            value={editingUser ? editingUser.email : (newUser.email || '')}
                            onChange={e => {
                              if (editingUser) setEditingUser({...editingUser, email: e.target.value});
                              else setNewUser({...newUser, email: e.target.value});
                            }}
                          />
                        </div>
                      </div>

                      {/* 3ª Linha: PIN, Tipo */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">PIN (4 DÍGITOS)</label>
                          <input 
                            type="password"
                            maxLength={4}
                            required={!editingUser}
                            placeholder={editingUser ? "Deixe em branco para manter" : "****"}
                            className="w-full px-5 py-3 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light font-medium text-lg"
                            value={editingUser ? (editingUser.pin === '****' ? '' : editingUser.pin) : (newUser.pin || '')}
                            onChange={e => {
                              const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                              if (editingUser) setEditingUser({...editingUser, pin: val});
                              else setNewUser({...newUser, pin: val});
                            }}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Tipo de Utilizador</label>
                          <select 
                            className="w-full px-5 py-3 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light font-medium text-lg appearance-none bg-white"
                            value={editingUser ? editingUser.role : (newUser.role || 'VIEWER')}
                            onChange={e => {
                              const val = e.target.value as UserRole;
                              if (editingUser) setEditingUser({...editingUser, role: val});
                              else setNewUser({...newUser, role: val});
                            }}
                          >
                            <option value="ADMIN">Administrador</option>
                            <option value="EDITOR">Editor / Gestor</option>
                            <option value="VIEWER">Visualizador / Leitor</option>
                          </select>
                        </div>
                      </div>

                      {/* 4ª Linha: LABEL "RECUPERAÇÃO DE CONTA" */}
                      <div className="pt-2 border-t border-slate-100">
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">RECUPERAÇÃO DE CONTA</p>
                      </div>

                      {/* 5ª Linha: Pergunta Pessoal, Resposta */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Pergunta Pessoal</label>
                          <input 
                            type="text"
                            placeholder="Ex: Nome do seu primeiro animal?"
                            className="w-full px-5 py-3 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light font-medium text-lg"
                            value={editingUser ? (editingUser.security_question || '') : (newUser.security_question || '')}
                            onChange={e => {
                              if (editingUser) setEditingUser({...editingUser, security_question: e.target.value});
                              else setNewUser({...newUser, security_question: e.target.value});
                            }}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Resposta à Pergunta</label>
                          <input 
                            type="text"
                            placeholder="A sua resposta secreta"
                            className="w-full px-5 py-3 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light font-medium text-lg"
                            value={editingUser ? (editingUser.security_answer || '') : (newUser.security_answer || '')}
                            onChange={e => {
                              if (editingUser) setEditingUser({...editingUser, security_answer: e.target.value});
                              else setNewUser({...newUser, security_answer: e.target.value});
                            }}
                          />
                        </div>
                      </div>

                      {/* 6ª Linha: Checkbox */}
                      <div className="flex items-center gap-4 pt-1">
                        <input 
                          type="checkbox"
                          id="user-active"
                          className="w-6 h-6 rounded border-slate-300 text-a2r-blue-dark focus:ring-a2r-blue-light"
                          checked={editingUser ? editingUser.active : (newUser.active ?? true)}
                          onChange={e => {
                            if (editingUser) setEditingUser({...editingUser, active: e.target.checked});
                            else setNewUser({...newUser, active: e.target.checked});
                          }}
                        />
                        <label htmlFor="user-active" className="text-base font-bold text-slate-700 cursor-pointer">Utilizador Ativo</label>
                      </div>

                      {/* 7ª Linha: Botoes */}
                      <div className="flex gap-6 pt-2">
                        <button 
                          type="button"
                          onClick={() => setShowUserManagementForm(false)}
                          className="flex-1 px-8 py-4 rounded-2xl border border-slate-200 text-slate-600 font-bold text-lg hover:bg-slate-50 transition-all"
                        >
                          Cancelar
                        </button>
                        <button 
                          type="submit"
                          disabled={loading}
                          className="flex-1 px-8 py-4 rounded-2xl a2r-gradient text-white font-bold text-lg shadow-lg shadow-blue-200 hover:opacity-90 transition-all disabled:opacity-50"
                        >
                          {loading ? 'A processar...' : 'Guardar'}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}

          {view === 'categories' && (
            <motion.div
              key="categories"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col flex-1 min-h-0 space-y-6"
            >
              <div className="flex items-center justify-between shrink-0">
                <h2 className="text-2xl font-bold text-slate-800">Famílias de Artigos</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={generateCategoriesReportPDF}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition-all shadow-sm"
                  >
                    <FileText size={18} />
                    Relatório
                  </button>
                  <button 
                    onClick={() => {
                      setEditingCategory(null);
                      setNewCategory({ nivel: 1 });
                      setShowCategoryForm(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 a2r-gradient text-white rounded-xl font-medium shadow-lg shadow-blue-200"
                  >
                    <Plus size={18} />
                    Nova Família
                  </button>
                  <button 
                    onClick={() => {
                      if (categoriesReturnView) {
                        setView(categoriesReturnView);
                        setCategoriesReturnView(null);
                        fetchCategories();
                      } else {
                        setView('menu');
                      }
                    }}
                    className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              {/* Search Filter */}
              <div className="relative shrink-0">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  type="text"
                  placeholder="Pesquisar por família ou subfamília..."
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white rounded-2xl border border-slate-100 shadow-sm outline-none focus:ring-2 focus:ring-a2r-blue-light transition-all font-medium text-slate-700"
                />
                {categorySearch && (
                  <button 
                    onClick={() => setCategorySearch('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-20">
                <div className="grid grid-cols-1 gap-6">
                  {categories
                    .filter(c => c.nivel === 1)
                    .filter(family => {
                      const search = categorySearch.toLowerCase();
                      if (!search) return true;
                      
                      const familyMatch = family.nome.toLowerCase().includes(search) || family.codigo.toLowerCase().includes(search);
                      const subfamilies = categories.filter(c => c.parent_id === family.id);
                      const subMatch = subfamilies.some(sub => sub.nome.toLowerCase().includes(search) || sub.codigo.toLowerCase().includes(search));
                      
                      return familyMatch || subMatch;
                    })
                    .map(family => (
                      <div key={family.id} className="group bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
                        {/* Family Header */}
                        <div className="p-5 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                          <div className="flex items-center gap-4 flex-1">
                            <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-white shadow-lg shadow-slate-200 group-hover:scale-110 transition-transform duration-300">
                              <span className="text-sm font-bold tracking-tighter">{family.codigo}</span>
                            </div>
                            <div className="flex-1 flex justify-between items-center pr-4">
                              <div>
                                <h3 className="text-lg font-bold text-slate-800 group-hover:text-a2r-blue-dark transition-colors">{family.nome}</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Família Principal</p>
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                                  {getCategoryStock(family.id)} un.
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button 
                              onClick={() => {
                                setEditingCategory(null);
                                setNewCategory({ nivel: 2, parent_id: family.id });
                                setShowCategoryForm(true);
                              }}
                              className="p-2.5 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                              title="Adicionar Subfamília"
                            >
                              <Plus size={20} />
                            </button>
                            <button 
                              onClick={() => {
                                setEditingCategory(family);
                                setShowCategoryForm(true);
                              }}
                              className="p-2.5 text-slate-400 hover:text-a2r-blue-dark hover:bg-blue-50 rounded-xl transition-all"
                              title="Editar"
                            >
                              <Edit size={20} />
                            </button>
                            <button 
                              onClick={() => handleDeleteCategory(family.id)}
                              className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                              title="Eliminar"
                            >
                              <Trash2 size={20} />
                            </button>
                          </div>
                        </div>
                        
                        {/* Subfamilies List */}
                        <div className="p-2 space-y-1 bg-white">
                          {categories
                            .filter(c => c.parent_id === family.id)
                            .filter(sub => {
                              const search = categorySearch.toLowerCase();
                              if (!search) return true;
                              // If family matches, show all subfamilies, OR if subfamily itself matches
                              const familyMatch = family.nome.toLowerCase().includes(search) || family.codigo.toLowerCase().includes(search);
                              const subMatch = sub.nome.toLowerCase().includes(search) || sub.codigo.toLowerCase().includes(search);
                              return familyMatch || subMatch;
                            })
                            .map((sub, idx, arr) => (
                          <div key={sub.id} className="relative group/sub">
                            {/* Tree Line */}
                            <div className="absolute left-6 top-0 bottom-0 w-px bg-slate-100"></div>
                            {idx === arr.length - 1 && (
                              <div className="absolute left-6 bottom-1/2 top-0 w-px bg-slate-100"></div>
                            )}
                            
                            <div className="ml-6 pl-6 py-3 pr-4 flex justify-between items-center rounded-2xl hover:bg-slate-50 transition-all duration-200">
                              {/* Horizontal Tree Line */}
                              <div className="absolute left-6 top-1/2 w-4 h-px bg-slate-100"></div>
                              
                              <div className="flex items-center gap-3 flex-1">
                                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 text-[10px] font-bold group-hover/sub:bg-a2r-blue-light/20 group-hover/sub:text-a2r-blue-dark transition-colors">
                                  {sub.codigo}
                                </div>
                                <div className="flex-1 flex justify-between items-center pr-4">
                                  <span className="font-semibold text-slate-700 group-hover/sub:text-slate-900 transition-colors">
                                    {sub.nome}
                                  </span>
                                  <span className="text-xs font-bold text-slate-400">
                                    {getCategoryStock(sub.id)} un.
                                  </span>
                                </div>
                              </div>
                              
                              <div className="flex gap-1 opacity-0 group-hover/sub:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => {
                                    setEditingCategory(sub);
                                    setShowCategoryForm(true);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-a2r-blue-dark hover:bg-blue-50 rounded-lg transition-all"
                                >
                                  <Edit size={16} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteCategory(sub.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {categories.filter(c => c.parent_id === family.id).length === 0 && (
                          <div className="ml-12 py-4 text-[11px] text-slate-400 italic flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                            Nenhuma subfamília registada.
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {categories.filter(c => c.nivel === 1).length === 0 && (
                  <div className="text-center py-24 bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
                    <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Layers size={48} className="text-slate-200" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Sem Famílias</h3>
                    <p className="text-slate-400 font-medium max-w-xs mx-auto">Comece por criar a sua primeira família de artigos para organizar o seu inventário.</p>
                  </div>
                )}
              </div>

              {/* Category Form Modal */}
              {showCategoryForm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden"
                  >
                    <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50 shrink-0">
                      <h3 className="text-xl font-bold text-slate-800 font-display">
                        {editingCategory ? 'Editar' : 'Nova'} { (editingCategory?.nivel === 2 || newCategory.nivel === 2) ? 'Subfamília' : 'Família' }
                      </h3>
                      <button onClick={() => setShowCategoryForm(false)} className="text-slate-400 hover:text-slate-600">
                        <X size={24} />
                      </button>
                    </div>
                    
                    <form onSubmit={handleCategorySubmit} className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
                      {newCategory.nivel === 2 && !editingCategory && (
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-widest">Família Pai</label>
                          <select 
                            className="w-full px-4 py-3 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light bg-slate-50 font-medium"
                            value={newCategory.parent_id || ''}
                            onChange={e => setNewCategory({...newCategory, parent_id: parseInt(e.target.value)})}
                            required
                          >
                            <option value="">Selecione uma família...</option>
                            {categories.filter(c => c.nivel === 1).map(f => (
                              <option key={f.id} value={f.id}>{f.codigo} - {f.nome}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-widest">Nome</label>
                        <input 
                          type="text"
                          autoFocus
                          required
                          className="w-full px-4 py-3 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light font-medium"
                          placeholder="Ex: Mobiliário, Cadeiras, etc."
                          value={editingCategory ? editingCategory.nome : (newCategory.nome || '')}
                          onChange={e => {
                            if (editingCategory) setEditingCategory({...editingCategory, nome: e.target.value});
                            else setNewCategory({...newCategory, nome: e.target.value});
                          }}
                        />
                      </div>

                      <div className="flex gap-4 pt-4">
                        <button 
                          type="button"
                          onClick={() => setShowCategoryForm(false)}
                          className="flex-1 px-6 py-3 rounded-2xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all"
                        >
                          Cancelar
                        </button>
                        <button 
                          type="submit"
                          disabled={loading}
                          className="flex-1 px-6 py-3 rounded-2xl a2r-gradient text-white font-bold shadow-lg shadow-blue-200 hover:opacity-90 transition-all disabled:opacity-50"
                        >
                          {loading ? 'A processar...' : 'Guardar'}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation - Fixed at bottom */}
      {user && (
        <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 px-1 py-2 z-50 shadow-lg">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <NavButton 
              active={view === 'menu'} 
              onClick={() => setView('menu')} 
              icon={<LayoutGrid size={20} />} 
              label="Menu" 
            />
            <NavButton 
              active={view === 'articles' || view === 'add-article' || view === 'edit-article'} 
              onClick={() => setView('articles')} 
              icon={<Package size={20} />} 
              label="Artigos" 
            />
            <NavButton 
              active={view === 'outputs'} 
              onClick={() => setView('outputs')} 
              icon={<ArrowUpRight size={20} />} 
              label="Entregas" 
            />
            <NavButton 
              active={view === 'inputs'} 
              onClick={() => setView('inputs')} 
              icon={<ArrowDownLeft size={20} />} 
              label="Recolhas" 
            />
            <NavButton 
              active={view === 'calendar'} 
              onClick={() => setView('calendar')} 
              icon={<Calendar size={20} />} 
              label="Calendário" 
            />
            <NavButton 
              active={view === 'position'} 
              onClick={() => setView('position')} 
              icon={<MapPin size={20} />} 
              label="Posição" 
            />
            <NavButton 
              active={view === 'history'} 
              onClick={() => setView('history')} 
              icon={<History size={20} />} 
              label="Histórico" 
            />
          </div>
        </nav>
      )}

      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-slate-100"
            >
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mb-6 mx-auto">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-center text-slate-800 mb-2">Eliminar Artigo?</h3>
              <p className="text-slate-500 text-center mb-8">
                Tem a certeza que deseja eliminar este artigo permanentemente? Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setArticleToDelete(null);
                  }}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    if (articleToDelete) {
                      executeDeleteArticle(articleToDelete);
                    }
                    setShowDeleteConfirm(false);
                    setArticleToDelete(null);
                  }}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors shadow-lg shadow-red-200"
                >
                  Eliminar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Article Search Modal */}
      <AnimatePresence>
        {showArticleSearchModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-2xl font-bold text-slate-800">Pesquisa de Artigos</h3>
                  <p className="text-sm text-slate-500">Selecione e valide o artigo antes de adicionar à entrega</p>
                </div>
                <button 
                  onClick={() => setShowArticleSearchModal(false)}
                  className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-slate-600 transition-all shadow-sm"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 flex-1 overflow-y-auto space-y-6">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input 
                    type="text"
                    autoFocus
                    placeholder="Pesquisar por código, descrição..."
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-a2r-blue-light outline-none text-lg"
                    value={articleSearchQuery}
                    onFocus={() => setArticleSearchQuery('')}
                    onChange={e => setArticleSearchQuery(e.target.value)}
                  />
                </div>

                <div className="space-y-3">
                  {articles
                    .filter(a => 
                      (a.code?.toLowerCase() || '').includes(articleSearchQuery.toLowerCase()) || 
                      (a.description?.toLowerCase() || '').includes(articleSearchQuery.toLowerCase())
                    )
                    .map(art => (
                      <button
                        key={art.id}
                        onClick={() => {
                          if (view === 'position') {
                            setPositionArticleId(art.id.toString());
                            setPositionSearchQuery(art.description);
                          } else if (showArticleSearchFor === 'start') {
                            setReportStartArticle(art);
                            setShowArticleSearchFor(null);
                          } else if (showArticleSearchFor === 'end') {
                            setReportEndArticle(art);
                            setShowArticleSearchFor(null);
                          } else {
                            setSelectedArticleId(art.id.toString());
                            setArticleSearchQuery(art.description);
                          }
                          setShowArticleSearchModal(false);
                        }}
                        className="w-full flex items-center gap-4 p-4 rounded-2xl border border-slate-100 hover:border-a2r-blue-light hover:bg-blue-50/30 transition-all text-left group"
                      >
                        <div className="w-20 h-20 bg-slate-100 rounded-xl flex-shrink-0 flex items-center justify-center text-slate-400 group-hover:bg-white transition-colors overflow-hidden">
                          {art.photo ? (
                            <img src={art.photo} alt={art.description} className="w-full h-full object-cover" />
                          ) : (
                            <Package size={32} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-bold text-slate-800 truncate">{art.code}</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                              art.available_stock > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                            }`}>
                              Stock: {art.available_stock}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 line-clamp-1 mb-1">{art.description}</p>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 px-2 py-0.5 rounded">
                              {art.height || 0}x{art.width || 0}x{art.length || 0} cm
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                </div>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button 
                  onClick={() => setShowArticleSearchModal(false)}
                  className="px-6 py-2 text-slate-600 font-medium hover:text-slate-800"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

          {/* Stock Entry/Exit Modals */}
          <AnimatePresence>
            {(showStockEntryForm || showStockExitForm) && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
                >
                  <div className={`p-6 text-white flex justify-between items-center ${stockForm.type === 'IN' ? 'bg-emerald-500' : 'bg-red-500'}`}>
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      {editingStockMovement ? <Edit2 /> : (stockForm.type === 'IN' ? <PlusCircle /> : <MinusCircle />)}
                      {editingStockMovement ? 'Editar Movimento' : (stockForm.type === 'IN' ? 'Entrada de Stock' : 'Saída de Stock')}
                    </h3>
                    <button onClick={() => { setShowStockEntryForm(false); setShowStockExitForm(false); setEditingStockMovement(null); }} className="p-1 hover:bg-white/20 rounded-lg transition-all">
                      <X size={24} />
                    </button>
                  </div>
                  
                  <form onSubmit={handleStockMovement} className="p-6 space-y-4">
                    {selectedStockArticle && (
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 mb-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Artigo Selecionado</p>
                        <p className="font-bold text-slate-800">{selectedStockArticle.code} - {selectedStockArticle.description}</p>
                      </div>
                    )}

                    {editingStockMovement && (
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Tipo de Movimento</label>
                        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                          <button
                            type="button"
                            onClick={() => setStockForm({...stockForm, type: 'IN'})}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                              stockForm.type === 'IN' 
                                ? 'bg-emerald-500 text-white shadow-sm' 
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            ENTRADA
                          </button>
                          <button
                            type="button"
                            onClick={() => setStockForm({...stockForm, type: 'OUT'})}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                              stockForm.type === 'OUT' 
                                ? 'bg-red-500 text-white shadow-sm' 
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            SAÍDA
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
                        <input 
                          type="date" 
                          required
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light"
                          value={stockForm.date}
                          onChange={e => setStockForm({...stockForm, date: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade</label>
                        <input 
                          type="number" 
                          required
                          min="1"
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light"
                          value={stockForm.quantity || ''}
                          onChange={e => setStockForm({...stockForm, quantity: parseInt(e.target.value) || 0})}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        {stockForm.type === 'IN' ? 'Nº Fatura' : 'Nº Documento'}
                      </label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light"
                        placeholder={stockForm.type === 'IN' ? 'Ex: FAT/2024/001' : 'Ex: DOC/001'}
                        value={stockForm.document_number}
                        onChange={e => setStockForm({...stockForm, document_number: e.target.value})}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Observações / Justificação</label>
                      <textarea 
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light h-24 resize-none"
                        placeholder={stockForm.type === 'IN' ? 'Ex: Compra de material novo...' : 'Ex: Material estragado / partido / venda...'}
                        value={stockForm.observations}
                        onChange={e => setStockForm({...stockForm, observations: e.target.value})}
                      />
                    </div>

                    <button 
                      type="submit"
                      disabled={loading}
                      className={`w-full py-3 rounded-xl text-white font-bold shadow-lg transition-all flex items-center justify-center gap-2 ${
                        stockForm.type === 'IN' ? 'bg-emerald-500 shadow-emerald-200 hover:bg-emerald-600' : 'bg-red-500 shadow-red-200 hover:bg-red-600'
                      }`}
                    >
                      {loading ? 'A processar...' : (editingStockMovement ? 'Atualizar Movimento' : 'Confirmar Registo')}
                    </button>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border ${
              toast.type === 'success' 
                ? 'bg-emerald-500 text-white border-emerald-400' 
                : toast.type === 'warning'
                ? 'bg-amber-500 text-white border-amber-400'
                : 'bg-red-500 text-white border-red-400'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span className="font-bold">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl space-y-6"
            >
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mx-auto">
                <AlertCircle size={32} />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold text-slate-800 mb-2">Confirmar Ação</h3>
                <p className="text-slate-500">{confirmModal.message}</p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setConfirmModal(null)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmModal.onConfirm}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold shadow-lg shadow-red-100 hover:bg-red-600 transition-all"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <datalist id="locations-list">
        {locations.map(loc => (
          <option key={loc.id} value={loc.name} />
        ))}
      </datalist>
      <datalist id="employees-list">
        {employees.map(emp => (
          <option key={emp.id} value={emp.name} />
        ))}
      </datalist>
    </div>
  );
}

function Combobox({ 
  value, 
  onChange, 
  options, 
  placeholder, 
  className,
  listId,
  inputRef
}: { 
  value: string, 
  onChange: (val: string) => void, 
  options: string[], 
  placeholder?: string, 
  className?: string,
  listId: string,
  inputRef?: React.RefObject<HTMLInputElement | null>
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearch(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Show all options if search matches current value exactly or is empty
  const filteredOptions = (search === value || !search) 
    ? options 
    : options.filter(opt => (opt?.toLowerCase() || '').includes(search.toLowerCase()));

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={className}
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>
      
      <AnimatePresence>
        {isOpen && (filteredOptions.length > 0 || search) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-[100] w-full mt-1 bg-white rounded-xl border border-slate-200 shadow-xl max-h-60 overflow-y-auto custom-scrollbar"
          >
            <div className="p-1">
              {filteredOptions.map((opt, i) => (
                <button
                  key={`${listId}-${i}`}
                  type="button"
                  onClick={() => {
                    onChange(opt);
                    setSearch(opt);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                    value === opt ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {opt}
                </button>
              ))}
              {search && !options.includes(search) && (
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-full text-left px-4 py-2 rounded-lg text-sm text-blue-500 italic hover:bg-slate-50"
                >
                  Novo: "{search}"
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-all ${
        active ? 'text-emerald-600 scale-110' : 'text-slate-400 hover:text-slate-600'
      }`}
    >
      <div className={`p-2 rounded-xl transition-colors ${active ? 'bg-emerald-50' : ''}`}>
        {icon}
      </div>
      <span className={`text-[10px] font-bold uppercase tracking-tighter ${active ? 'text-emerald-700' : ''}`}>{label}</span>
    </button>
  );
}

import React, { useState, useEffect } from 'react';
import { User, Article, Movement, Output, OutputItem, OutputType, Location } from './types';
import { 
  Package, 
  LogOut, 
  Plus, 
  Search,
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
  MapPin,
  Phone,
  Printer,
  Download,
  Calendar,
  User as UserIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PhotoUpload } from './components/PhotoUpload';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type View = 'login' | 'menu' | 'articles' | 'register-user' | 'add-article' | 'edit-article' | 'forgot-pin' | 'outputs' | 'inputs' | 'history' | 'calendar';

export default function App() {
  const [view, setView] = useState<View>('login');
  const [user, setUser] = useState<User | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [articles, setArticles] = useState<Article[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [outputs, setOutputs] = useState<Output[]>([]); // Entregas
  const [movements, setMovements] = useState<Movement[]>([]); // Recolhas
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [confirmModal, setConfirmModal] = useState<{message: string, onConfirm: () => void} | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{url: string, output: Output} | null>(null);

  // Forgot PIN State
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [newPin, setNewPin] = useState('');
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3>(1);

  // Search & Filters
  const [articleSearch, setArticleSearch] = useState('');

  // Custom Confirmation Modal State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [articleToDelete, setArticleToDelete] = useState<number | null>(null);

  // Forms
  const [newArticle, setNewArticle] = useState<Partial<Article>>({});
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [newUser, setNewUser] = useState<Partial<User>>({});

  // Output Form State
  const [outputForm, setOutputForm] = useState<Partial<Output>>({
    type: 'ALUGUER',
    with_assembly: false,
    items: []
  });
  const [editingOutputId, setEditingOutputId] = useState<number | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string>('');
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);

  // Return Form State
  const [selectedOutputId, setSelectedOutputId] = useState<string>('');
  const [returnItems, setReturnItems] = useState<Record<number, number>>({});
  const [editingMovementId, setEditingMovementId] = useState<number | null>(null);
  const [editingMovementData, setEditingMovementData] = useState<{quantity: number, observations: string}>({quantity: 0, observations: ''});

  const [showOutputForm, setShowOutputForm] = useState(false);
  const [showInputForm, setShowInputForm] = useState(false);
  const [outputSearch, setOutputSearch] = useState('');
  const [outputStatusFilter, setOutputStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SETTLED'>('ACTIVE');
  const [outputStartDate, setOutputStartDate] = useState('2026-01-01');
  const [expandedOutputs, setExpandedOutputs] = useState<Record<number, boolean>>({});
  const [inputSearch, setInputSearch] = useState('');
  const [inputStatusFilter, setInputStatusFilter] = useState<'ACTIVE' | 'COMPLETED' | 'ALL'>('ACTIVE');
  const [inputStartDate, setInputStartDate] = useState('2026-01-01');
  const [showArticleSearchModal, setShowArticleSearchModal] = useState(false);
  const [articleSearchQuery, setArticleSearchQuery] = useState('');
  const [historyArticleFilter, setHistoryArticleFilter] = useState('');
  const [historyStartDate, setHistoryStartDate] = useState('2026-01-01');
  const [calendarDate, setCalendarDate] = useState(new Date().toISOString().split('T')[0]);
  const [outputFormTab, setOutputFormTab] = useState<'info' | 'items'>('info');

  const articleCodeInputRef = React.useRef<HTMLInputElement>(null);

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
    if (user) {
      fetchArticles();
      fetchLocations();
      fetchOutputs();
      fetchMovements();
    }
  }, [user, view]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchArticles = async () => {
    const res = await fetch('/api/articles');
    const data = await res.json();
    setArticles(data);
  };

  const fetchLocations = async () => {
    const res = await fetch('/api/locations');
    const data = await res.json();
    setLocations(data);
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

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    if (pin.length !== 4) return;
    
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
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
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      if (res.ok) {
        setView('login');
        setNewUser({});
        showToast('Utilizador registado com sucesso!');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newArticle)
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

  const handleEditArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingArticle) return;
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
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...outputForm,
          user_id: user?.id
        })
      });

      if (res.ok) {
        showToast(editingOutputId ? 'Entrega atualizada com sucesso!' : 'Entrega registada com sucesso!');
        await fetchArticles();
        await fetchLocations();
        await fetchOutputs();
        setShowOutputForm(false);
        setEditingOutputId(null);
        setOutputForm({
          type: 'ALUGUER',
          with_assembly: false,
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
          showToast('Recolha atualizada com sucesso!');
          await fetchArticles();
          await fetchOutputs();
          await fetchMovements();
          setShowInputForm(false);
          setEditingMovementId(null);
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
          user_id: user?.id
        })
      });

      if (res.ok) {
        showToast('Recolha registada com sucesso!');
        await fetchArticles();
        await fetchOutputs();
        await fetchMovements();
        setShowInputForm(false);
        setSelectedOutputId('');
        setReturnItems({});
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
    drawLabelValue('DATA ENTREGA : ', output.delivery_date ? new Date(output.delivery_date).toLocaleString() : 'N/A');
    drawLabelValue('DATA MONTAGEM : ', output.assembly_date ? new Date(output.assembly_date).toLocaleString() : 'N/A');
    drawLabelValue('DATA RECOLHA : ', output.collection_date ? new Date(output.collection_date).toLocaleString() : 'N/A');
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
      item.quantity_out.toString(),
      item.quantity_in > 0 ? item.quantity_in.toString() : ''
    ]) || [];

    autoTable(doc, {
      startY: y + 5,
      head: [['MATERIAL', 'ENTREGUE', 'RECOLHIDO']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [0, 51, 102], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3, font: 'helvetica' },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 30, halign: 'center' },
        2: { cellWidth: 30, halign: 'center' }
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

    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    setPdfPreview({ url, output });
  };

  const closePdfPreview = () => {
    if (pdfPreview?.url.startsWith('blob:')) {
      URL.revokeObjectURL(pdfPreview.url);
    }
    setPdfPreview(null);
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

  const handleForgotPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/forgot-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail })
      });
      if (res.ok) {
        setForgotStep(2);
      } else {
        const data = await res.json();
        setError(data.error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCodeStep = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, code: forgotCode })
      });
      if (res.ok) {
        setForgotStep(3);
      } else {
        const data = await res.json();
        setError(data.error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length !== 4) {
      setError('O PIN deve ter 4 dígitos.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/reset-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, code: forgotCode, newPin })
      });
      if (res.ok) {
        showToast('PIN alterado com sucesso!');
        setView('login');
        setForgotStep(1);
        setForgotEmail('');
        setForgotCode('');
        setNewPin('');
      } else {
        const data = await res.json();
        setError(data.error);
      }
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
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 relative">
        <div className="absolute top-6 right-6">
          <button 
            onClick={() => {
              if (window.confirm('Deseja realmente sair e fechar a aplicação?')) {
                window.close();
                window.location.href = "about:blank";
              }
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
              onClick={() => setView('register-user')}
              className="text-sm text-a2r-blue-dark font-medium hover:underline text-center"
            >
              Novo Utilizador? Registar
            </button>
            <button 
              onClick={() => setView('forgot-pin')}
              className="text-xs text-slate-400 hover:underline text-center"
            >
              Esqueceu o PIN?
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (view === 'forgot-pin') {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center">
        <Logo />
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-slate-100"
        >
          <h2 className="text-2xl font-semibold mb-6 text-slate-800 text-center">Recuperar PIN</h2>
          
          {forgotStep === 1 && (
            <form onSubmit={handleForgotPin} className="space-y-4">
              <p className="text-sm text-slate-500 text-center mb-4">
                Introduza o seu email para receber um código de recuperação.
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input 
                  type="email" 
                  required
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-a2r-blue-light outline-none"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                />
              </div>
              {error && <p className="text-red-500 text-xs text-center">{error}</p>}
              <button 
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl a2r-gradient text-white font-medium hover:opacity-90 disabled:opacity-50"
              >
                {loading ? 'A processar...' : 'Enviar Código'}
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

          {forgotStep === 2 && (
            <form onSubmit={handleVerifyCodeStep} className="space-y-4">
              <p className="text-sm text-slate-500 text-center mb-4">
                Introduza o código de 6 dígitos enviado para <strong>{forgotEmail}</strong>.
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Código de Verificação</label>
                <input 
                  type="text" 
                  required
                  maxLength={6}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-a2r-blue-light outline-none text-center text-2xl tracking-widest"
                  value={forgotCode}
                  onChange={e => setForgotCode(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              {error && <p className="text-red-500 text-xs text-center">{error}</p>}
              <button 
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl a2r-gradient text-white font-medium hover:opacity-90 disabled:opacity-50"
              >
                {loading ? 'A verificar...' : 'Verificar Código'}
              </button>
              <button 
                type="button"
                onClick={() => setForgotStep(1)}
                className="w-full text-sm text-slate-400 hover:underline"
              >
                Alterar Email
              </button>
            </form>
          )}

          {forgotStep === 3 && (
            <form onSubmit={handleResetPin} className="space-y-4">
              <p className="text-sm text-slate-500 text-center mb-4">
                Defina o seu novo PIN de 4 dígitos.
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Novo PIN</label>
                <input 
                  type="password" 
                  required
                  maxLength={4}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-a2r-blue-light outline-none text-center text-2xl tracking-widest"
                  value={newPin}
                  onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              {error && <p className="text-red-500 text-xs text-center">{error}</p>}
              <button 
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl a2r-gradient text-white font-medium hover:opacity-90 disabled:opacity-50"
              >
                {loading ? 'A guardar...' : 'Alterar PIN'}
              </button>
            </form>
          )}
        </motion.div>
      </div>
    );
  }

  if (view === 'register-user') {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center">
        <Logo />
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-slate-100">
          <h2 className="text-2xl font-semibold mb-6 text-slate-800">Registo de Utilizador</h2>
          <form onSubmit={handleRegisterUser} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
              <input 
                type="text" 
                required
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-a2r-blue-light outline-none"
                value={newUser.name || ''}
                onChange={e => setNewUser({...newUser, name: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input 
                type="email" 
                required
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-a2r-blue-light outline-none"
                value={newUser.email || ''}
                onChange={e => setNewUser({...newUser, email: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">PIN (4 dígitos)</label>
              <input 
                type="password" 
                maxLength={4}
                required
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-a2r-blue-light outline-none"
                value={newUser.pin || ''}
                onChange={e => setNewUser({...newUser, pin: e.target.value.replace(/\D/g, '')})}
              />
            </div>
            <PhotoUpload 
              onPhotoCapture={base64 => setNewUser({...newUser, photo: base64})}
              currentPhoto={newUser.photo}
              label="Foto de Perfil"
            />
            <div className="flex gap-4 pt-4">
              <button 
                type="button"
                onClick={() => setView('login')}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                disabled={loading}
                className="flex-1 py-3 rounded-xl a2r-gradient text-white font-medium hover:opacity-90 disabled:opacity-50"
              >
                {loading ? 'A registar...' : 'Registar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 z-30 shadow-sm">
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

      <main className="flex-1 max-w-5xl w-full mx-auto p-6 overflow-hidden">
        <AnimatePresence mode="wait">
          {view === 'menu' && (
            <motion.div
              key="menu"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-2 gap-6"
            >
              <button
                onClick={() => setView('articles')}
                className="flex flex-col items-center justify-center p-8 bg-white rounded-3xl shadow-lg border border-slate-100 hover:shadow-xl hover:scale-105 transition-all group"
              >
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-a2r-blue-dark mb-4 group-hover:bg-a2r-blue-dark group-hover:text-white transition-colors">
                  <Package size={32} />
                </div>
                <span className="text-lg font-bold text-slate-800">Artigos</span>
              </button>

              <button
                onClick={() => setView('outputs')}
                className="flex flex-col items-center justify-center p-8 bg-white rounded-3xl shadow-lg border border-slate-100 hover:shadow-xl hover:scale-105 transition-all group"
              >
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mb-4 group-hover:bg-red-500 group-hover:text-white transition-colors">
                  <ArrowUpRight size={32} />
                </div>
                <span className="text-lg font-bold text-slate-800">Entregas</span>
              </button>

              <button
                onClick={() => setView('inputs')}
                className="flex flex-col items-center justify-center p-8 bg-white rounded-3xl shadow-lg border border-slate-100 hover:shadow-xl hover:scale-105 transition-all group"
              >
                <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 mb-4 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                  <ArrowDownLeft size={32} />
                </div>
                <span className="text-lg font-bold text-slate-800">Recolhas</span>
              </button>

              <button
                onClick={() => setView('calendar')}
                className="flex flex-col items-center justify-center p-8 bg-white rounded-3xl shadow-lg border border-slate-100 hover:shadow-xl hover:scale-105 transition-all group"
              >
                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <Calendar size={32} />
                </div>
                <span className="text-lg font-bold text-slate-800">Calendário</span>
              </button>

              <button
                onClick={() => setView('history')}
                className="flex flex-col items-center justify-center p-8 bg-white rounded-3xl shadow-lg border border-slate-100 hover:shadow-xl hover:scale-105 transition-all group"
              >
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-600 mb-4 group-hover:bg-slate-600 group-hover:text-white transition-colors">
                  <History size={32} />
                </div>
                <span className="text-lg font-bold text-slate-800">Histórico</span>
              </button>
            </motion.div>
          )}

          {view === 'articles' && (
            <motion.div
              key="articles"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col h-full space-y-6"
            >
              <div className="flex items-center justify-between shrink-0">
                <h2 className="text-2xl font-bold text-slate-800">Artigos</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setView('add-article')}
                    className="flex items-center gap-2 px-4 py-2 a2r-gradient text-white rounded-xl font-medium shadow-lg shadow-blue-200"
                  >
                    <Plus size={18} />
                    Novo Artigo
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
                    placeholder="Pesquisar por código, descrição ou dimensões..."
                    className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 bg-white focus:ring-2 focus:ring-a2r-blue-light outline-none"
                    value={articleSearch}
                    onFocus={() => setArticleSearch('')}
                    onChange={e => setArticleSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                {articles
                  .filter(a => {
                    const search = articleSearch.toLowerCase();
                    return a.code.toLowerCase().includes(search) || 
                           a.description.toLowerCase().includes(search) ||
                           `${a.height}x${a.width}x${a.length}`.includes(search);
                  })
                  .map(article => (
                  <div 
                    key={article.id} 
                    onClick={() => {
                      setEditingArticle(article);
                      setView('edit-article');
                    }}
                    className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm hover:shadow-md transition-shadow group cursor-pointer flex items-center gap-4"
                  >
                    <div className="w-16 h-16 rounded-xl bg-slate-50 overflow-hidden relative flex-shrink-0">
                      {article.photo ? (
                        <img src={article.photo} alt={article.description} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <Package size={24} />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-bold text-slate-600 uppercase">
                          {article.code}
                        </span>
                        <h3 className="font-bold text-slate-800 line-clamp-1">{article.description}</h3>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Dim: {article.height}x{article.width}x{article.length}cm
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end gap-2">
                      <div className="text-right leading-tight">
                        <p className="text-[10px] text-slate-400 font-medium">Stock Inicial: {article.initial_stock}</p>
                        <p className={`text-sm font-bold ${article.available_stock > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {article.available_stock} Disponível
                        </p>
                      </div>
                      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                        <button 
                          onClick={() => confirmDeleteArticle(article.id)}
                          className="p-1.5 rounded-lg bg-slate-50 text-slate-400 hover:text-red-500 transition-all"
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

          {view === 'edit-article' && editingArticle && (
            <motion.div 
              key="edit-article"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col h-full max-w-2xl mx-auto bg-white rounded-3xl p-8 border border-slate-100 shadow-xl overflow-hidden"
            >
              <h2 className="text-2xl font-bold mb-6 text-slate-800 shrink-0">Editar Artigo</h2>
              <form onSubmit={handleEditArticle} className="flex flex-col h-full overflow-hidden">
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
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
                      <label className="block text-sm font-medium text-slate-700 mb-1">Stock Inicial</label>
                      <input 
                        type="number" 
                        required
                        min="0"
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light"
                        value={editingArticle.initial_stock ?? ''}
                        onChange={e => setEditingArticle({...editingArticle, initial_stock: parseInt(e.target.value) || 0})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Stock Disponível</label>
                      <input 
                        type="number" 
                        disabled
                        className="w-full px-4 py-2 rounded-xl border border-slate-100 bg-slate-50 text-slate-500 cursor-not-allowed outline-none"
                        value={editingArticle.available_stock ?? 0}
                      />
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
                  <div className="grid grid-cols-3 gap-4">
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
            </motion.div>
          )}

          {view === 'calendar' && (
            <motion.div
              key="calendar"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col h-full space-y-6"
            >
              <div className="flex items-center justify-between shrink-0">
                <h2 className="text-2xl font-bold text-slate-800">Calendário</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setCalendarDate(new Date().toISOString().split('T')[0])}
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
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                    <Calendar size={24} />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Data Selecionada</label>
                    <input 
                      type="date" 
                      className="w-full px-0 py-0 text-xl font-bold text-slate-800 bg-transparent border-none outline-none focus:ring-0 cursor-pointer"
                      value={calendarDate}
                      onChange={e => setCalendarDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-8 custom-scrollbar pb-20">
                {/* Entregas Section */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 px-2">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Entregas do Dia</h3>
                  </div>
                  {(() => {
                    const dayOutputs = outputs.filter(o => o.delivery_date?.split('T')[0] === calendarDate);
                    if (dayOutputs.length === 0) return <p className="text-sm text-slate-400 italic px-2">Nenhuma entrega agendada para este dia.</p>;
                    return dayOutputs.map(output => (
                      <div key={`cal-out-${output.id}`} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="text-[10px] font-bold text-red-500 uppercase bg-red-50 px-2 py-0.5 rounded">#{output.id}</span>
                            <h4 className="font-bold text-slate-800 mt-1">{output.client_name}</h4>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-slate-600">{new Date(output.delivery_date!).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                            <p className="text-[10px] text-slate-400 uppercase font-medium">{output.type}</p>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <MapPin size={12} />
                          {output.location_name}
                        </p>
                      </div>
                    ));
                  })()}
                </section>

                {/* Recolhas Ativas Section */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 px-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Recolhas Ativas (Agendadas)</h3>
                  </div>
                  {(() => {
                    const dayActiveRecolhas = outputs.filter(o => 
                      o.collection_date?.split('T')[0] === calendarDate && 
                      o.items?.some(item => item.quantity_out > item.quantity_in)
                    );
                    if (dayActiveRecolhas.length === 0) return <p className="text-sm text-slate-400 italic px-2">Nenhuma recolha ativa agendada para este dia.</p>;
                    return dayActiveRecolhas.map(output => (
                      <div key={`cal-act-${output.id}`} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all border-l-4 border-l-emerald-500">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="text-[10px] font-bold text-emerald-500 uppercase bg-emerald-50 px-2 py-0.5 rounded">#{output.id}</span>
                            <h4 className="font-bold text-slate-800 mt-1">{output.client_name}</h4>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-slate-600">{new Date(output.collection_date!).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                            <p className="text-[10px] text-slate-400 uppercase font-medium">{output.items?.filter(i => i.quantity_out > i.quantity_in).length} Artigos Pendentes</p>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <MapPin size={12} />
                          {output.location_name}
                        </p>
                      </div>
                    ));
                  })()}
                </section>

                {/* Recolhas Efetuadas Section */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 px-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Recolhas Efetuadas</h3>
                  </div>
                  {(() => {
                    const dayMovements = movements.filter(m => 
                      m.type === 'IN' && 
                      m.date.split('T')[0] === calendarDate &&
                      (m.observations?.includes('Recolha') || m.observations?.includes('Retorno'))
                    );
                    if (dayMovements.length === 0) return <p className="text-sm text-slate-400 italic px-2">Nenhuma recolha efetuada neste dia.</p>;
                    return dayMovements.map(movement => (
                      <div key={`cal-mov-${movement.id}`} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all border-l-4 border-l-blue-500">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-500">
                              <Package size={16} />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-800 text-sm">{movement.article_description}</h4>
                              <p className="text-[10px] text-slate-400 font-mono">{movement.article_code}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-black text-blue-600">{movement.quantity}</p>
                            <p className="text-[10px] text-blue-400 font-bold uppercase">Unidades</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
                          <p className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Clock size={10} />
                            {new Date(movement.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </p>
                          <p className="text-[10px] text-slate-400 flex items-center gap-1">
                            <UserIcon size={10} />
                            {movement.user_name}
                          </p>
                        </div>
                      </div>
                    ));
                  })()}
                </section>
              </div>
            </motion.div>
          )}

          {view === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col h-full space-y-6"
            >
              <div className="flex items-center justify-between shrink-0">
                <h2 className="text-2xl font-bold text-slate-800">Histórico</h2>
                <button 
                  onClick={() => setView('menu')}
                  className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={24} />
                </button>
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
                      const matchesArticle = h.article_description.toLowerCase().includes(historyArticleFilter.toLowerCase()) ||
                                           h.article_code.toLowerCase().includes(historyArticleFilter.toLowerCase());
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
                              {new Date(item.date).toLocaleDateString('pt-PT')} {new Date(item.date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
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
              className="flex flex-col h-full space-y-6"
            >
              <div className="flex items-center justify-between shrink-0">
                <h2 className="text-2xl font-bold text-slate-800">
                  {showInputForm ? (editingMovementId ? 'Editar Recolha' : 'Nova Recolha') : 'Recolhas'}
                </h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setShowInputForm(!showInputForm);
                      if (!showInputForm) {
                        setSelectedOutputId('');
                        setReturnItems({});
                        setEditingMovementId(null);
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
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Artigo</label>
                          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <p className="font-bold text-slate-800">{movements.find(m => m.id === editingMovementId)?.article_description}</p>
                            <p className="text-xs text-slate-500">{movements.find(m => m.id === editingMovementId)?.article_code}</p>
                          </div>
                        </div>
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
                                }
                              } else {
                                setReturnItems({});
                              }
                            }}
                          >
                            <option value="">Escolha uma entrega...</option>
                            {outputs.filter(o => o.items?.some(item => item.quantity_out > item.quantity_in)).map(out => (
                              <option key={out.id} value={out.id}>
                                #{out.id} - {out.client_name} ({out.location_name}) - {new Date(out.created_at).toLocaleDateString()}
                              </option>
                            ))}
                          </select>
                        </div>

                        {selectedOutputId && (
                          <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
                    <div className="relative">
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
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-500 whitespace-nowrap">Desde:</span>
                      <input 
                        type="date" 
                        className="flex-1 px-4 py-2 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={inputStartDate}
                        onChange={e => setInputStartDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0 overflow-x-auto pb-2">
                    <button 
                      onClick={() => setInputStatusFilter('ACTIVE')}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                        inputStatusFilter === 'ACTIVE' 
                          ? 'bg-emerald-500 text-white shadow-md' 
                          : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-50'
                      }`}
                    >
                      Ativas
                    </button>
                    <button 
                      onClick={() => setInputStatusFilter('COMPLETED')}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                        inputStatusFilter === 'COMPLETED' 
                          ? 'bg-emerald-500 text-white shadow-md' 
                          : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-50'
                      }`}
                    >
                      Efetuadas
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

                  <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                    {(() => {
                      const activeOutputs = outputs.filter(o => {
                        const isSettled = o.items?.every(item => item.quantity_out === item.quantity_in);
                        const isActive = !isSettled;
                        const matchesSearch = o.client_name.toLowerCase().includes(inputSearch.toLowerCase()) || 
                                            o.location_name?.toLowerCase().includes(inputSearch.toLowerCase());
                        const matchesDate = !inputStartDate || (o.collection_date && o.collection_date >= inputStartDate);
                        return isActive && matchesSearch && matchesDate;
                      }).map(o => ({ ...o, listType: 'ACTIVE' as const }));

                      const completedMovements = movements.filter(m => {
                        if (m.type !== 'IN' || !m.observations?.includes('Recolha')) return false;
                        const outputIdMatch = m.observations?.match(/#(\d+)/);
                        const outputId = outputIdMatch ? parseInt(outputIdMatch[1]) : null;
                        const relatedOutput = outputId ? outputs.find(o => o.id === outputId) : null;
                        
                        const matchesSearch = (relatedOutput?.client_name.toLowerCase().includes(inputSearch.toLowerCase()) || 
                                             relatedOutput?.location_name?.toLowerCase().includes(inputSearch.toLowerCase()) ||
                                             m.article_description.toLowerCase().includes(inputSearch.toLowerCase()));
                        const matchesDate = !inputStartDate || (m.date && m.date >= inputStartDate);
                        return matchesSearch && matchesDate;
                      }).map(m => {
                        const outputIdMatch = m.observations?.match(/#(\d+)/);
                        const outputId = outputIdMatch ? parseInt(outputIdMatch[1]) : null;
                        const relatedOutput = outputId ? outputs.find(o => o.id === outputId) : null;
                        return { ...m, listType: 'COMPLETED' as const, relatedOutput };
                      });

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
                                          Ativa
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
                                      <button 
                                        onClick={() => {
                                          setSelectedOutputId(output.id.toString());
                                          const initialReturns: Record<number, number> = {};
                                          output.items?.forEach(item => {
                                            initialReturns[item.article_id] = item.quantity_out - item.quantity_in;
                                          });
                                          setReturnItems(initialReturns);
                                          setShowInputForm(true);
                                        }}
                                        className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-md hover:bg-emerald-600 transition-all"
                                      >
                                        Nova Recolha
                                      </button>
                                    </div>
                                  </div>

                                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-slate-400">
                                    <div>
                                      <p className="uppercase tracking-wider font-semibold mb-1">Entrega</p>
                                      <p className="text-slate-600 font-medium">
                                        {output.delivery_date ? new Date(output.delivery_date).toLocaleDateString() : 'N/A'}
                                        {output.delivery_date && <span className="block text-[10px] opacity-70">{new Date(output.delivery_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="uppercase tracking-wider font-semibold mb-1">Montagem</p>
                                      <p className="text-slate-600 font-medium">
                                        {output.assembly_date ? new Date(output.assembly_date).toLocaleDateString() : 'N/A'}
                                        {output.assembly_date && <span className="block text-[10px] opacity-70">{new Date(output.assembly_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="uppercase tracking-wider font-semibold mb-1 text-emerald-500">Recolha</p>
                                      <p className="text-emerald-600 font-bold">
                                        {output.collection_date ? new Date(output.collection_date).toLocaleDateString() : 'N/A'}
                                        {output.collection_date && <span className="block text-[10px] opacity-70">{new Date(output.collection_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                                      </p>
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
                                            {output.items?.map(item => (
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
                            const movement = item;
                            const output = movement.relatedOutput;
                            const isExpanded = expandedOutputs[output?.id || 0];

                            return (
                              <div key={`completed-${movement.id}`} className="bg-white rounded-3xl border border-slate-100 shadow-lg hover:shadow-xl transition-all overflow-hidden border-l-4 border-l-emerald-500">
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
                                          Efetuada
                                        </span>
                                      </div>
                                      <h3 className="text-lg font-bold text-slate-800">{output?.client_name || 'N/A'}</h3>
                                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                        <p className="text-sm text-slate-500 flex items-center gap-1">
                                          <MapPin size={14} className="text-slate-400" />
                                          {output?.location_name} {output?.space_at_location && `(${output?.space_at_location})`}
                                        </p>
                                        {output?.client_contact && (
                                          <p className="text-sm text-slate-500 flex items-center gap-1">
                                            <Phone size={14} className="text-slate-400" />
                                            {output.client_contact}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
                                      <button 
                                        onClick={() => {
                                          setEditingMovementId(movement.id);
                                          setEditingMovementData({
                                            quantity: movement.quantity,
                                            observations: movement.observations || ''
                                          });
                                          setShowInputForm(true);
                                        }}
                                        className="p-2 text-slate-400 hover:text-emerald-500 transition-colors bg-slate-50 rounded-xl"
                                        title="Editar Recolha"
                                      >
                                        <Edit size={18} />
                                      </button>
                                      <button 
                                        onClick={() => handleDeleteMovement(movement.id)}
                                        className="p-2 text-slate-400 hover:text-red-500 transition-colors bg-slate-50 rounded-xl"
                                        title="Anular Recolha"
                                      >
                                        <Trash2 size={18} />
                                      </button>
                                    </div>
                                  </div>

                                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-slate-400">
                                    <div>
                                      <p className="uppercase tracking-wider font-semibold mb-1">Entrega</p>
                                      <p className="text-slate-600 font-medium">
                                        {output?.delivery_date ? new Date(output.delivery_date).toLocaleDateString() : 'N/A'}
                                        {output?.delivery_date && <span className="block text-[10px] opacity-70">{new Date(output.delivery_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="uppercase tracking-wider font-semibold mb-1">Montagem</p>
                                      <p className="text-slate-600 font-medium">
                                        {output?.assembly_date ? new Date(output.assembly_date).toLocaleDateString() : 'N/A'}
                                        {output?.assembly_date && <span className="block text-[10px] opacity-70">{new Date(output.assembly_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="uppercase tracking-wider font-semibold mb-1 text-emerald-500">Recolha</p>
                                      <p className="text-emerald-600 font-bold">
                                        {output?.collection_date ? new Date(output.collection_date).toLocaleDateString() : 'N/A'}
                                        {output?.collection_date && <span className="block text-[10px] opacity-70">{new Date(output.collection_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="uppercase tracking-wider font-semibold mb-1">Artigos</p>
                                      <p className="text-slate-600 font-medium">{output?.items?.length || 0} Itens</p>
                                      <button 
                                        onClick={() => setExpandedOutputs({...expandedOutputs, [output?.id || 0]: !isExpanded})}
                                        className="flex items-center gap-1 text-emerald-600 font-bold hover:underline mt-1"
                                      >
                                        {isExpanded ? 'Ocultar' : 'Ver'}
                                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                      </button>
                                    </div>
                                  </div>

                                  <AnimatePresence>
                                    {isExpanded && output && (
                                      <motion.div 
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="mt-6 pt-6 border-t border-slate-50 overflow-hidden"
                                      >
                                        <div className="bg-slate-50 rounded-2xl p-4">
                                          <p className="text-xs font-bold text-slate-400 uppercase mb-3 tracking-widest">Artigos da Entrega</p>
                                          <div className="space-y-3">
                                            {output.items?.map(item => (
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

                                  <div className="mt-4 flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                    <div className="flex items-center gap-1">
                                      <Clock size={12} />
                                      {new Date(movement.date).toLocaleDateString()} {new Date(movement.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <UserIcon size={12} />
                                      {movement.user_name}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                        });
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
              className="flex flex-col h-full space-y-6"
            >
              <div className="flex items-center justify-between shrink-0">
                <h2 className="text-2xl font-bold text-slate-800">
                  {showOutputForm ? (editingOutputId ? 'Editar Entrega' : 'Nova Entrega') : 'Entregas'}
                </h2>
                <div className="flex gap-2">
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
                                <label className="block text-sm font-medium text-slate-700 mb-1">Data/Hora Entrega</label>
                                <input 
                                  type="datetime-local" 
                                  className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light"
                                  value={outputForm.delivery_date || ''}
                                  onChange={e => setOutputForm({...outputForm, delivery_date: e.target.value})}
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Data/Hora Montagem</label>
                                <input 
                                  type="datetime-local" 
                                  className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light"
                                  value={outputForm.assembly_date || ''}
                                  onChange={e => setOutputForm({...outputForm, assembly_date: e.target.value})}
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Data/Hora Recolha</label>
                                <input 
                                  type="datetime-local" 
                                  className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light"
                                  value={outputForm.collection_date || ''}
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
                                <datalist id="locations-list">
                                  {locations.map(loc => (
                                    <option key={loc.id} value={loc.name} />
                                  ))}
                                </datalist>
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
                                        const exactMatch = articles.find(a => a.code.toLowerCase() === e.target.value.toLowerCase());
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
                                            a.code.toLowerCase().includes(articleSearchQuery.toLowerCase()) || 
                                            a.description.toLowerCase().includes(articleSearchQuery.toLowerCase())
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
                                  onChange={e => setSelectedQuantity(parseInt(e.target.value) || 1)}
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
                                            min="0"
                                            className="w-20 px-2 py-1 rounded-lg border border-slate-200 text-center font-bold text-red-500 focus:ring-2 focus:ring-a2r-blue-light outline-none"
                                            value={item.quantity_out}
                                            onChange={(e) => {
                                              const val = parseInt(e.target.value) || 0;
                                              if (val === 0) {
                                                if ((item.quantity_in || 0) > 0) {
                                                  showToast('Não pode eliminar um artigo que já tem recolhas.', 'error');
                                                  return;
                                                }
                                                removeItemFromOutput(item.article_id);
                                              } else {
                                                if (val < (item.quantity_in || 0)) {
                                                  showToast(`A quantidade de entrega não pode ser inferior à quantidade já recolhida (${item.quantity_in}).`, 'error');
                                                  return;
                                                }
                                                const newItems = [...(outputForm.items || [])];
                                                newItems[idx].quantity_out = val;
                                                setOutputForm({ ...outputForm, items: newItems });
                                              }
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
                                                isOpen: true,
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
                  <div className="flex flex-col md:flex-row gap-4 shrink-0">
                    <div className="relative flex-1">
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
                    <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm">
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
                        Ativas
                      </button>
                      <button 
                        onClick={() => setOutputStatusFilter('SETTLED')}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${outputStatusFilter === 'SETTLED' ? 'bg-blue-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                      >
                        Saldadas
                      </button>
                      <button 
                        onClick={() => setOutputStatusFilter('ALL')}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${outputStatusFilter === 'ALL' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                      >
                        Todas
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                    {outputs
                      .filter(o => {
                        const matchesSearch = o.client_name.toLowerCase().includes(outputSearch.toLowerCase()) || 
                                            o.location_name?.toLowerCase().includes(outputSearch.toLowerCase());
                        
                        const matchesDate = !outputStartDate || (o.delivery_date && o.delivery_date >= outputStartDate);
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
                                    {isSettled ? (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-500 border border-blue-100">
                                        Saldada
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-500 border border-emerald-100">
                                        Ativa
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
                                    onClick={() => {
                                      setEditingOutputId(output.id);
                                      setOutputForm({
                                        type: output.type,
                                        client_name: output.client_name,
                                        client_contact: output.client_contact,
                                        delivery_date: output.delivery_date,
                                        assembly_date: output.assembly_date,
                                        collection_date: output.collection_date,
                                        with_assembly: output.with_assembly,
                                        location_name: output.location_name,
                                        space_at_location: output.space_at_location,
                                        observations: output.observations,
                                        items: output.items
                                      });
                                      setShowOutputForm(true);
                                    }}
                                    className="p-2 text-slate-300 hover:text-a2r-blue-dark hover:bg-blue-50 rounded-xl transition-all"
                                    title="Editar"
                                  >
                                    <Edit size={20} />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteOutput(output.id)}
                                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                    title="Eliminar"
                                  >
                                    <Trash2 size={20} />
                                  </button>
                                </div>
                              </div>
                              
                              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-slate-400">
                                <div>
                                  <p className="uppercase tracking-wider font-semibold mb-1">Entrega</p>
                                  <p className="text-slate-600 font-medium">
                                    {output.delivery_date ? new Date(output.delivery_date).toLocaleDateString() : 'N/A'}
                                    {output.delivery_date && <span className="block text-[10px] opacity-70">{new Date(output.delivery_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                                  </p>
                                </div>
                                <div>
                                  <p className="uppercase tracking-wider font-semibold mb-1">Montagem</p>
                                  <p className="text-slate-600 font-medium">
                                    {output.assembly_date ? new Date(output.assembly_date).toLocaleDateString() : 'N/A'}
                                    {output.assembly_date && <span className="block text-[10px] opacity-70">{new Date(output.assembly_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                                  </p>
                                </div>
                                <div>
                                  <p className="uppercase tracking-wider font-semibold mb-1">Recolha</p>
                                  <p className="text-slate-600 font-medium">
                                    {output.collection_date ? new Date(output.collection_date).toLocaleDateString() : 'N/A'}
                                    {output.collection_date && <span className="block text-[10px] opacity-70">{new Date(output.collection_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                                  </p>
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
                                  <div className="p-6 space-y-3">
                                    <div className="grid grid-cols-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">
                                      <div className="col-span-2">Artigo</div>
                                      <div className="text-center">Entrega</div>
                                      <div className="text-center">Recolha</div>
                                    </div>
                                    {output.items?.map(item => (
                                      <div key={item.id} className="grid grid-cols-4 items-center bg-white p-3 rounded-xl border border-slate-100 text-sm">
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
                      <label className="block text-sm font-medium text-slate-700 mb-1">Stock Inicial</label>
                      <input 
                        type="number" 
                        required
                        min="0"
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-a2r-blue-light"
                        value={newArticle.initial_stock || ''}
                        onChange={e => setNewArticle({...newArticle, initial_stock: parseInt(e.target.value)})}
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
                  <div className="grid grid-cols-3 gap-4">
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
        </AnimatePresence>
      </main>

      {/* Bottom Navigation - Hidden on smartphones */}
      {user && (
        <nav className="hidden sm:block bg-white border-t border-slate-200 px-1 py-2 z-10 shrink-0">
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
                      a.code.toLowerCase().includes(articleSearchQuery.toLowerCase()) || 
                      a.description.toLowerCase().includes(articleSearchQuery.toLowerCase())
                    )
                    .map(art => (
                      <button
                        key={art.id}
                        onClick={() => {
                          setSelectedArticleId(art.id.toString());
                          setArticleSearchQuery(art.description);
                          setShowArticleSearchModal(false);
                        }}
                        disabled={art.available_stock <= 0}
                        className="w-full flex items-center gap-4 p-4 rounded-2xl border border-slate-100 hover:border-a2r-blue-light hover:bg-blue-50/30 transition-all text-left group disabled:opacity-50 disabled:hover:border-slate-100 disabled:hover:bg-transparent"
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

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border ${
              toast.type === 'success' 
                ? 'bg-emerald-500 text-white border-emerald-400' 
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
        {/* PDF Preview Modal */}
        <AnimatePresence>
          {pdfPreview && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
            >
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden"
              >
                <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">Pré-visualização da Ordem de Entrega</h3>
                    <p className="text-sm text-slate-500">#{pdfPreview.output.id} - {pdfPreview.output.client_name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => window.open(pdfPreview.url, '_blank')}
                      className="p-2 text-slate-500 hover:text-a2r-blue-dark hover:bg-slate-50 rounded-xl transition-all"
                      title="Abrir em Nova Janela"
                    >
                      <ArrowUpRight size={20} />
                    </button>
                    <button 
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = pdfPreview.url;
                        link.download = `Ordem_Entrega_${pdfPreview.output.id}.pdf`;
                        link.click();
                      }}
                      className="p-2 text-slate-500 hover:text-a2r-blue-dark hover:bg-slate-50 rounded-xl transition-all"
                      title="Descarregar PDF"
                    >
                      <Download size={20} />
                    </button>
                    <button 
                      onClick={() => closePdfPreview()}
                      className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
                    >
                      <X size={24} />
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 bg-slate-100 p-4 overflow-hidden relative">
                  <iframe 
                    key={pdfPreview.url}
                    src={pdfPreview.url} 
                    className="w-full h-full rounded-xl border border-slate-200 shadow-inner bg-white"
                    title="PDF Preview"
                  />
                </div>
                
                <div className="p-6 border-t border-slate-100 flex justify-end gap-4 shrink-0">
                  <button 
                    onClick={() => closePdfPreview()}
                    className="px-6 py-2 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50"
                  >
                    Fechar
                  </button>
                  <a 
                    href={pdfPreview.url} 
                    download={`Ordem_Entrega_${pdfPreview.output.id}.pdf`}
                    className="px-8 py-2 rounded-xl a2r-gradient text-white font-bold shadow-lg shadow-blue-200 hover:opacity-90"
                  >
                    Descarregar PDF
                  </a>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

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

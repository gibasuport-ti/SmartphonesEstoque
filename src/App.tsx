/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Smartphone Stock Manager - v1.0.5 - Security Implementation
import React, { useState, useEffect, useRef, Component } from 'react';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  Timestamp, 
  getDocFromServer,
  doc,
  deleteDoc
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { db, auth } from './firebase';
import { Smartphone, OperationType, FirestoreErrorInfo } from './types';
import { cn } from './lib/utils';
import { 
  X, 
  Check, 
  Upload, 
  LogOut, 
  Smartphone as PhoneIcon, 
  FileText, 
  Table as TableIcon, 
  AlertCircle,
  Loader2,
  Plus,
  Search,
  Info,
  FileUp,
  Download,
  QrCode,
  Camera,
  ScanText,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { Html5Qrcode } from 'html5-qrcode';
import Tesseract from 'tesseract.js';
import { Toaster, toast } from 'sonner';

// Error handling function as per spec
function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Error Boundary Component
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Ocorreu um erro inesperado.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error) errorMessage = parsed.error;
      } catch (e) {
        errorMessage = this.state.error.message || errorMessage;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-red-50 text-red-900">
          <AlertCircle className="w-12 h-12 mb-4" />
          <h1 className="text-xl font-bold mb-2">Ops! Algo deu errado.</h1>
          <p className="text-center mb-4 max-w-md">{errorMessage}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Recarregar Aplicativo
          </button>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

const BRANDS = ['SAMSUNG', 'APPLE', 'MOTOROLA', 'XIAOMI', 'LG', 'OUTROS'];
const MODELS: Record<string, string[]> = {
  'SAMSUNG': ['SAMSUNG A12', 'SAMSUNG S21', 'SAMSUNG S22', 'SAMSUNG A52', 'SAMSUNG A32'],
  'APPLE': ['IPHONE 11', 'IPHONE 12', 'IPHONE 13', 'IPHONE 14', 'IPHONE 15'],
  'MOTOROLA': ['MOTO G10', 'MOTO G30', 'MOTO G54', 'MOTO G60', 'MOTO EDGE 20'],
  'XIAOMI': ['REDMI NOTE 10', 'REDMI NOTE 11', 'POCO X3', 'MI 11'],
  'LG': ['LG K52', 'LG K62', 'LG VELVET'],
  'OUTROS': ['OUTRO MODELO']
};
const CONDITIONS = ['BOM', 'REGULAR', 'RUIM', 'DANIFICADO'];

function SecurityLock({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const targetPassword = import.meta.env.VITE_APP_ACCESS_KEY || '1234';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === targetPassword) {
      sessionStorage.setItem('app_unlocked', 'true');
      onUnlock();
    } else {
      setError(true);
      toast.error('Chave de acesso incorreta!');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-100 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 text-center border-t-8 border-blue-600"
      >
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <PhoneIcon className="w-10 h-10 text-blue-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Acesso Restrito</h1>
        <p className="text-slate-500 text-sm mb-8 italic">Controle de Estoque Interno</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-left">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Chave de Segurança</label>
            <input 
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(false);
              }}
              placeholder="Digite a senha..."
              className={cn(
                "w-full p-4 bg-slate-50 border rounded-2xl outline-none transition-all text-center text-xl tracking-widest font-mono",
                error ? "border-red-500 bg-red-50" : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              )}
              autoFocus
            />
          </div>
          <button 
            type="submit"
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 active:scale-[0.98] transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
          >
            Acessar Sistema
          </button>
        </form>
        <p className="mt-8 text-[10px] text-slate-300 uppercase tracking-tighter">Smartphone Stock Manager v1.1.0 - Protegido</p>
      </motion.div>
    </div>
  );
}

export default function App() {
  const [isUnlocked, setIsUnlocked] = useState(() => sessionStorage.getItem('app_unlocked') === 'true');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [smartphones, setSmartphones] = useState<Smartphone[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<Smartphone>>({
    marca: 'SAMSUNG',
    modelo: 'SAMSUNG A12',
    estado: 'BOM',
    data_devolucao: new Date().toISOString().split('T')[0]
  });
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPhone, setSelectedPhone] = useState<Smartphone | null>(null);
  const [deletePhoneId, setDeletePhoneId] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showOcrScanner, setShowOcrScanner] = useState(false);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ocrVideoRef = useRef<HTMLVideoElement>(null);
  const ocrCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    // Fallback timeout for loading state
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;

    if (showScanner) {
      html5QrCode = new Html5Qrcode("reader");
      const config = { fps: 10, qrbox: { width: 250, height: 250 } };

      html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          setFormData(prev => ({ ...prev, serial: decodedText.toUpperCase() }));
          setShowScanner(false);
          if (html5QrCode) {
            html5QrCode.stop().catch(err => console.error("Error stopping scanner", err));
          }
        },
        undefined
      ).catch(err => console.error("Error starting scanner", err));
    }

    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(err => console.error("Error stopping scanner on cleanup", err));
      }
    };
  }, [showScanner]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let intervalId: any = null;

    if (showOcrScanner) {
      const startCamera = async () => {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
          });
          if (ocrVideoRef.current) {
            ocrVideoRef.current.srcObject = stream;
            
            // Start automatic scanning loop
            intervalId = setInterval(async () => {
              if (!ocrVideoRef.current || !ocrCanvasRef.current || isOcrLoading) return;
              
              const video = ocrVideoRef.current;
              const canvas = ocrCanvasRef.current;
              const context = canvas.getContext('2d');
              
              if (context && video.readyState === video.HAVE_ENOUGH_DATA) {
                // Crop to a horizontal strip in the center
                const cropWidth = video.videoWidth * 0.8;
                const cropHeight = video.videoHeight * 0.2;
                const startX = (video.videoWidth - cropWidth) / 2;
                const startY = (video.videoHeight - cropHeight) / 2;

                canvas.width = cropWidth;
                canvas.height = cropHeight;
                
                // Draw the cropped area
                context.drawImage(video, startX, startY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
                
                // Basic image processing: grayscale and contrast
                const imageData = context.getImageData(0, 0, cropWidth, cropHeight);
                const data = imageData.data;
                for (let i = 0; i < data.length; i += 4) {
                  const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                  // Increase contrast
                  const contrast = 1.5;
                  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
                  const newValue = factor * (avg - 128) + 128;
                  data[i] = data[i + 1] = data[i + 2] = newValue;
                }
                context.putImageData(imageData, 0, 0);

                try {
                  const result = await Tesseract.recognize(canvas, 'eng', {
                    // Force Tesseract to only consider these characters to avoid O/0, I/1 confusion
                    tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
                  } as any);
                  const text = result.data.text.replace(/\s/g, '').toUpperCase();
                  
                  // Look for IMEI (exactly 15 digits)
                  const imeiMatch = text.match(/\d{15}/);
                  if (imeiMatch) {
                    setFormData(prev => ({ ...prev, serial: imeiMatch[0] }));
                    setShowOcrScanner(false);
                    return;
                  }

                  // Look for Serial (8-15 alphanumeric)
                  const serialMatch = text.match(/[A-Z0-9]{8,15}/);
                  if (serialMatch && serialMatch[0].length >= 8) {
                    // Only auto-capture if it looks very much like a serial (has letters and numbers)
                    const hasLetters = /[A-Z]/.test(serialMatch[0]);
                    const hasNumbers = /[0-9]/.test(serialMatch[0]);
                    if (hasLetters && hasNumbers) {
                      setFormData(prev => ({ ...prev, serial: serialMatch[0] }));
                      setShowOcrScanner(false);
                    }
                  }
                } catch (err) {
                  console.error('Auto OCR Error:', err);
                }
              }
            }, 1500); // Scan every 1.5 seconds
          }
        } catch (err) {
          console.error('Camera Error:', err);
          alert('Erro ao acessar a câmera. Verifique as permissões.');
          setShowOcrScanner(false);
        }
      };
      startCamera();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [showOcrScanner]);

  useEffect(() => {
    if (!user) {
      setSmartphones([]);
      return;
    }

    const q = query(
      collection(db, 'smartphones'),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Smartphone[];
      setSmartphones(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'smartphones');
    });

    return () => unsubscribe();
  }, [user]);

  // Connection test as per spec
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();
  }, []);

  const handleLogin = async () => {
    setLoginError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.code === 'auth/unauthorized-domain') {
        setLoginError('Domínio não autorizado. Adicione "localhost" no Console do Firebase.');
      } else if (error.code === 'auth/popup-blocked') {
        setLoginError('O popup foi bloqueado pelo navegador. Por favor, permita popups.');
      } else {
        setLoginError('Erro ao fazer login: ' + (error.message || 'Erro desconhecido'));
      }
    }
  };

  const handleExport = () => {
    if (smartphones.length === 0) {
      toast.error('Não há dados para exportar.');
      return;
    }

    try {
      // Prepare data for export
      const exportData = smartphones.map(phone => ({
        Marca: phone.marca,
        Modelo: phone.modelo,
        Serial: phone.serial,
        Estado: phone.estado,
        'Devolvido Por': phone.devolvido_por || '',
        'Data Devolução': phone.data_devolucao || '',
        Observação: phone.observacao || '',
        'Data Cadastro': phone.createdAt ? new Date(phone.createdAt).toLocaleString('pt-BR') : ''
      }));

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Estoque");

      // Generate filename with current date
      const date = new Date().toISOString().split('T')[0];
      const filename = `backup_estoque_${date}.xlsx`;

      // Download file
      XLSX.writeFile(workbook, filename);
    } catch (error) {
      console.error('Erro ao exportar dados:', error);
      alert('Ocorreu um erro ao gerar o backup.');
    }
  };

  const captureAndOcr = async () => {
    if (!ocrVideoRef.current || !ocrCanvasRef.current || isOcrLoading) return;

    const video = ocrVideoRef.current;
    const canvas = ocrCanvasRef.current;
    const context = canvas.getContext('2d');
    
    if (context) {
      setIsOcrLoading(true);
      try {
        // Full frame capture for manual button
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const result = await Tesseract.recognize(canvas, 'eng', {
          tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
        } as any);
        const text = result.data.text.replace(/\s/g, '').toUpperCase();
        console.log('Manual OCR Result:', text);
        
        const imeiMatch = text.match(/\d{15}/);
        if (imeiMatch) {
          setFormData(prev => ({ ...prev, serial: imeiMatch[0] }));
          setShowOcrScanner(false);
        } else {
          const serialMatch = text.match(/[A-Z0-9]{8,15}/);
          if (serialMatch) {
            setFormData(prev => ({ ...prev, serial: serialMatch[0] }));
            setShowOcrScanner(false);
          } else {
            toast.error('Não foi possível identificar um IMEI ou Serial. Tente aproximar mais a câmera ou alinhar melhor o texto.');
          }
        }
      } catch (err) {
        console.error('OCR Error:', err);
        toast.error('Erro ao processar imagem.');
      } finally {
        setIsOcrLoading(false);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleDelete = async () => {
    const deleteKey = import.meta.env.VITE_APP_DELETE_KEY || 'ExcluirAgora';
    if (deletePassword !== deleteKey) {
      toast.error('Senha incorreta!');
      return;
    }

    if (!deletePhoneId) return;

    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'smartphones', deletePhoneId));
      toast.success('Smartphone excluído com sucesso!');
      setDeletePhoneId(null);
      setDeletePassword('');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'smartphones');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFormError(null);
    
    if (!user) return;
    
    if (!formData.marca || !formData.modelo || !formData.serial || !formData.estado) {
      setFormError('Por favor, preencha todos os campos obrigatórios.');
      toast.error('Campos obrigatórios faltando.');
      return;
    }

    // Check for duplicate serial
    const isDuplicate = smartphones.some(s => s.serial.toUpperCase() === formData.serial?.toUpperCase());
    if (isDuplicate) {
      setFormError('Smartphone já cadastrado!');
      toast.error('Smartphone já cadastrado!');
      return;
    }

    setIsSaving(true);
    try {
      const newSmartphone: Smartphone = {
        marca: formData.marca,
        modelo: formData.modelo,
        serial: formData.serial,
        estado: formData.estado,
        devolvido_por: formData.devolvido_por || '',
        data_devolucao: formData.data_devolucao || '',
        observacao: formData.observacao || '',
        uid: user.uid,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'smartphones'), newSmartphone);
      setShowForm(false);
      setFormData({
        marca: 'SAMSUNG',
        modelo: 'SAMSUNG A12',
        estado: 'BOM',
        data_devolucao: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'smartphones');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('File input changed');
    const file = e.target.files?.[0];
    if (!file) {
      console.log('No file selected');
      return;
    }
    if (!user) {
      toast.error('Usuário não autenticado');
      return;
    }

    console.log('Processing file:', file.name);
    const reader = new FileReader();
    const extension = file.name.split('.').pop()?.toLowerCase();

    reader.onload = async (event) => {
      const result = event.target?.result;
      if (!result) return;

      let data: any[] = [];

      if (extension === 'xlsx' || extension === 'xls') {
        const workbook = XLSX.read(result, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(worksheet);
      } else if (extension === 'csv') {
        Papa.parse(result as string, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            processImportedData(results.data);
          }
        });
        return;
      } else if (extension === 'txt') {
        const content = result as string;
        const lines = content.split(/\r?\n/).filter(line => line.trim());
        if (lines.length < 2) return;
        
        const headers = lines[0].split(/[\t,;]/).map(h => h.trim());
        data = lines.slice(1).map(line => {
          const values = line.split(/[\t,;]/);
          const obj: any = {};
          headers.forEach((header, i) => {
            if (header) obj[header] = values[i]?.trim();
          });
          return obj;
        });
      }

      if (data.length > 0) {
        processImportedData(data);
      }
    };

    if (extension === 'xlsx' || extension === 'xls') {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };

  const processImportedData = async (rawData: any[]) => {
    if (!user) return;
    setLoading(true);
    try {
      const existingSerials = new Set(smartphones.map(s => s.serial.toUpperCase()));
      
      for (const item of rawData) {
        // Normalize keys to lowercase for flexible matching
        const normalizedItem: any = {};
        Object.keys(item).forEach(key => {
          normalizedItem[key.toLowerCase().trim()] = item[key];
        });

        const marca = normalizedItem.marca || normalizedItem.brand;
        const modelo = normalizedItem.modelo || normalizedItem.model;
        const serial = normalizedItem.serial || normalizedItem.sn || normalizedItem['s/n'];
        const estado = normalizedItem.estado || normalizedItem.condition || 'BOM';
        const devolvido_por = normalizedItem.devolvido_por || normalizedItem.returned_by || '';
        const data_devolucao = normalizedItem.data_devolucao || normalizedItem.return_date || new Date().toISOString().split('T')[0];
        const observacao = normalizedItem.observacao || normalizedItem.notes || '';

        if (marca && modelo && serial) {
          const serialUpper = String(serial).toUpperCase();
          
          if (existingSerials.has(serialUpper)) {
            console.warn(`Smartphone com serial ${serialUpper} já cadastrado. Pulando...`);
            continue;
          }

          const newSmartphone: Smartphone = {
            marca: String(marca).toUpperCase(),
            modelo: String(modelo).toUpperCase(),
            serial: serialUpper,
            estado: String(estado).toUpperCase(),
            devolvido_por: String(devolvido_por),
            data_devolucao: String(data_devolucao),
            observacao: String(observacao),
            uid: user.uid,
            createdAt: new Date().toISOString()
          };
          await addDoc(collection(db, 'smartphones'), newSmartphone);
          existingSerials.add(serialUpper);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'smartphones');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!isUnlocked) {
    return (
      <ErrorBoundary>
        <SecurityLock onUnlock={() => setIsUnlocked(true)} />
      </ErrorBoundary>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center"
        >
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <PhoneIcon className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Smartphone Stock</h1>
          <p className="text-slate-500 mb-8">Gerencie seu estoque de smartphones de forma simples e segura.</p>
          
          {loginError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex items-start gap-3 text-left">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-bold mb-1">Erro de Autenticação</p>
                <p>{loginError}</p>
                {loginError.includes('localhost') && (
                  <p className="mt-2 text-xs opacity-80">
                    Vá em Firebase Console &gt; Auth &gt; Settings &gt; Authorized domains e adicione "localhost".
                  </p>
                )}
              </div>
            </div>
          )}

          <button 
            onClick={handleLogin}
            className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" referrerPolicy="no-referrer" />
            Entrar com Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-100 pb-20 font-sans selection:bg-blue-100">
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          accept=".csv, .xlsx, .xls, .txt" 
          className="hidden" 
        />
        {/* Header */}
        <header className="bg-blue-700 text-white p-4 sticky top-0 z-30 shadow-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PhoneIcon className="w-6 h-6" />
            <h1 className="text-lg font-semibold">Smartphones em estoque</h1>
          </div>
          <div className="flex items-center gap-2">
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={handleExport}
              className="p-2 bg-green-600 hover:bg-green-500 rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-sm border border-green-400"
              title="Fazer Backup (Excel)"
            >
              <Download className="w-5 h-5" />
              <span className="text-xs font-semibold">Backup</span>
            </motion.button>
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                console.log('Import button clicked');
                if (fileInputRef.current) {
                  fileInputRef.current.click();
                } else {
                  console.error('fileInputRef.current is null');
                }
              }}
              className="p-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-sm border border-blue-400"
              title="Importar Dados"
            >
              <Upload className="w-5 h-5" />
              <span className="text-xs font-semibold">Importar</span>
            </motion.button>
            <button 
              onClick={handleLogout}
              className="p-2 hover:bg-blue-600 rounded-full transition-colors"
              title="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="p-4 max-w-2xl mx-auto">
          {/* Stats / Actions */}
          <div className="flex items-center justify-between mb-4">
            <div className="text-slate-600">
              <span className="font-bold text-slate-900">{smartphones.length}</span> smartphones cadastrados
            </div>
            <button 
              onClick={() => {
                setFormError(null);
                setShowForm(true);
              }}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all shadow-md"
            >
              <Plus className="w-4 h-4" />
              Novo Item
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text"
              placeholder="Pesquisar por Marca, Modelo, Serial ou Estado..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-sm"
            />
          </div>

          {searchTerm && (
            <div className="mb-4 px-1">
              <p className="text-xs text-slate-500 font-medium italic">
                {(() => {
                  const filteredCount = smartphones.filter(phone => {
                    const search = searchTerm.toLowerCase();
                    return (
                      phone.marca.toLowerCase().includes(search) ||
                      phone.modelo.toLowerCase().includes(search) ||
                      phone.serial.toLowerCase().includes(search) ||
                      phone.estado.toLowerCase().includes(search)
                    );
                  }).length;
                  return filteredCount === 1 
                    ? `1 item encontrado para "${searchTerm}"`
                    : `${filteredCount} itens encontrados para "${searchTerm}"`;
                })()}
              </p>
            </div>
          )}

          {/* List */}
          <div className="space-y-4">
            {smartphones.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
                <PhoneIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-400">Nenhum smartphone no estoque.</p>
                <button onClick={() => {
                  setFormError(null);
                  setShowForm(true);
                }} className="text-blue-600 font-medium mt-2">Adicionar o primeiro</button>
              </div>
            ) : (
              (() => {
                const filtered = smartphones.filter(phone => {
                  const search = searchTerm.toLowerCase();
                  return (
                    phone.marca.toLowerCase().includes(search) ||
                    phone.modelo.toLowerCase().includes(search) ||
                    phone.serial.toLowerCase().includes(search) ||
                    phone.estado.toLowerCase().includes(search)
                  );
                });

                if (filtered.length === 0 && searchTerm !== '') {
                  return (
                    <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
                      <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500 font-medium">Item não cadastrado</p>
                      <p className="text-slate-400 text-sm">Tente outro termo de pesquisa</p>
                    </div>
                  );
                }

                return filtered.map((phone) => (
                  <motion.div 
                    layout
                    key={phone.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 group hover:border-blue-300 transition-colors"
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-lg flex items-center justify-center shrink-0",
                      phone.estado === 'BOM' ? "bg-green-100 text-green-600" : 
                      phone.estado === 'REGULAR' ? "bg-yellow-100 text-yellow-600" : 
                      "bg-red-100 text-red-600"
                    )}>
                      <PhoneIcon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900 truncate">{phone.modelo}</h3>
                      <p className="text-xs text-slate-500 uppercase tracking-wider">{phone.marca} • S/N: {phone.serial}</p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right hidden sm:block">
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-1 rounded-full uppercase",
                          phone.estado === 'BOM' ? "bg-green-100 text-green-700" : 
                          phone.estado === 'REGULAR' ? "bg-yellow-100 text-yellow-700" : 
                          "bg-red-100 text-red-700"
                        )}>
                          {phone.estado}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-1">{new Date(phone.createdAt).toLocaleDateString()}</p>
                      </div>
                      <button 
                        onClick={() => setSelectedPhone(phone)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Ver Detalhes"
                      >
                        <Info className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => setDeletePhoneId(phone.id!)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir Item"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </motion.div>
                ));
              })()
            )}
          </div>
        </main>

        {/* Details Modal */}
        <AnimatePresence>
          {selectedPhone && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedPhone(null)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
              >
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <h2 className="text-xl font-bold text-slate-900">Detalhes do Smartphone</h2>
                  <button 
                    onClick={() => setSelectedPhone(null)}
                    className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Marca</p>
                      <p className="font-bold text-slate-900">{selectedPhone.marca}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Modelo</p>
                      <p className="font-bold text-slate-900">{selectedPhone.modelo}</p>
                    </div>
                  </div>

                  <div className="p-4 bg-yellow-50 rounded-2xl border border-yellow-100">
                    <p className="text-[10px] uppercase font-bold text-yellow-600 mb-1">Serial Number (S/N)</p>
                    <p className="font-mono font-bold text-slate-900">{selectedPhone.serial}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className={cn(
                      "p-4 rounded-2xl border",
                      selectedPhone.estado === 'BOM' ? "bg-green-50 border-green-100" : 
                      selectedPhone.estado === 'REGULAR' ? "bg-yellow-50 border-yellow-100" : 
                      "bg-red-50 border-red-100"
                    )}>
                      <p className={cn(
                        "text-[10px] uppercase font-bold mb-1",
                        selectedPhone.estado === 'BOM' ? "text-green-600" : 
                        selectedPhone.estado === 'REGULAR' ? "text-yellow-600" : 
                        "text-red-600"
                      )}>Estado</p>
                      <p className="font-bold text-slate-900">{selectedPhone.estado}</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-2xl border border-green-100">
                      <p className="text-[10px] uppercase font-bold text-green-600 mb-1">Devolvido Por</p>
                      <p className="font-bold text-slate-900">{selectedPhone.devolvido_por}</p>
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                    <p className="text-[10px] uppercase font-bold text-blue-600 mb-1">Data de Devolução</p>
                    <p className="font-bold text-slate-900">{new Date(selectedPhone.data_devolucao).toLocaleDateString()}</p>
                  </div>

                  {selectedPhone.observacoes && (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Observações</p>
                      <p className="text-slate-700 text-sm whitespace-pre-wrap">{selectedPhone.observacoes}</p>
                    </div>
                  )}

                  <div className="pt-4 text-[10px] text-slate-400 flex justify-between">
                    <span>ID: {selectedPhone.id}</span>
                    <span>Cadastrado em: {new Date(selectedPhone.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-100">
                  <button 
                    onClick={() => setSelectedPhone(null)}
                    className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Form Modal */}
        <AnimatePresence>
          {showForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-[#D9E2F3] w-full max-w-md rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
              >
                {/* Image-like Header */}
                <div className="bg-[#4472C4] text-white p-3 flex items-center justify-between">
                  <button onClick={() => setShowForm(false)} className="p-1 hover:bg-white/10 rounded">
                    <X className="w-6 h-6" />
                  </button>
                  <h2 className="text-lg font-medium">Smartphones em estoque</h2>
                  <button 
                    onClick={() => handleSave()} 
                    disabled={isSaving}
                    className="p-1 hover:bg-white/10 rounded disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Check className="w-6 h-6" />}
                  </button>
                </div>

                {formError && (
                  <div className="bg-red-500 text-white p-3 text-sm font-bold flex items-center gap-2 animate-pulse">
                    <AlertCircle className="w-5 h-5" />
                    {formError}
                  </div>
                )}

                <div className="p-4 space-y-4 overflow-y-auto">
                  {/* MARCA */}
                  <div>
                    <label className="block text-[10px] font-bold text-blue-900 uppercase mb-1">Marca</label>
                    <select 
                      value={formData.marca}
                      onChange={(e) => {
                        const brand = e.target.value;
                        setFormData({ ...formData, marca: brand, modelo: MODELS[brand][0] });
                      }}
                      className="w-full bg-white border border-blue-300 p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>

                  {/* MODELO */}
                  <div>
                    <label className="block text-[10px] font-bold text-blue-900 uppercase mb-1">Modelo</label>
                    <select 
                      value={formData.modelo}
                      onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                      className="w-full bg-white border border-blue-300 p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {MODELS[formData.marca || 'SAMSUNG'].map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>

                  {/* SERIAL - Yellow Background as in image */}
                  <div className="bg-[#FFFF00] p-2 -mx-4 px-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2">
                      <label className="block text-[10px] font-bold text-blue-900 uppercase">Serial / IMEI</label>
                      <div className="flex flex-wrap gap-2">
                        <button 
                          type="button"
                          onClick={() => setShowScanner(true)}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded text-[10px] font-bold hover:bg-blue-700 transition-colors shadow-sm"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          ESCANEAR
                        </button>
                        <button 
                          type="button"
                          onClick={() => setShowOcrScanner(true)}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1 bg-purple-600 text-white px-3 py-1.5 rounded text-[10px] font-bold hover:bg-purple-700 transition-colors shadow-sm"
                        >
                          <ScanText className="w-3.5 h-3.5" />
                          CAPTURAR TEXTO
                        </button>
                      </div>
                    </div>
                    <input 
                      type="text"
                      value={formData.serial || ''}
                      onChange={(e) => setFormData({ ...formData, serial: e.target.value.toUpperCase() })}
                      className="w-full bg-white border border-slate-300 p-2.5 text-sm focus:outline-none shadow-inner"
                      placeholder="Digite o serial ou IMEI..."
                    />
                  </div>

                  {/* ESTADO */}
                  <div>
                    <label className="block text-[10px] font-bold text-blue-900 uppercase mb-1">Estado</label>
                    <select 
                      value={formData.estado}
                      onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                      className="w-full bg-white border border-blue-300 p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  {/* DEVOLVIDO_POR - Green Background as in image */}
                  <div className="bg-[#4CAF50] p-2 -mx-4 px-4">
                    <label className="block text-[10px] font-bold text-white uppercase mb-1">Devolvido_Por</label>
                    <input 
                      type="text"
                      value={formData.devolvido_por || ''}
                      onChange={(e) => setFormData({ ...formData, devolvido_por: e.target.value })}
                      className="w-full bg-white border border-slate-300 p-2 text-sm focus:outline-none"
                    />
                  </div>

                  {/* DATA_DEVOLUCAO */}
                  <div>
                    <label className="block text-[10px] font-bold text-blue-900 uppercase mb-1">Data_Devolucao</label>
                    <input 
                      type="date"
                      value={formData.data_devolucao}
                      onChange={(e) => setFormData({ ...formData, data_devolucao: e.target.value })}
                      className="w-full bg-white border border-blue-300 p-2 text-sm focus:outline-none"
                    />
                  </div>

                  {/* OBSERVACAO */}
                  <div>
                    <label className="block text-[10px] font-bold text-blue-900 uppercase mb-1">Observacao</label>
                    <textarea 
                      value={formData.observacao || ''}
                      onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                      className="w-full bg-white border border-blue-300 p-2 text-sm focus:outline-none min-h-[100px]"
                    />
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showScanner && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black p-4">
              <div className="relative w-full max-w-lg bg-white rounded-2xl overflow-hidden">
                <div className="p-4 border-b flex justify-between items-center">
                  <h3 className="font-bold">Escanear Código</h3>
                  <button onClick={() => setShowScanner(false)} className="p-1 hover:bg-slate-100 rounded">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div id="reader" className="w-full"></div>
                <div className="p-4 text-center text-sm text-slate-500">
                  Aponte para o código de barras ou QR Code
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showOcrScanner && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 sm:p-4">
              <div className="relative w-full h-full sm:h-auto sm:max-w-lg bg-white sm:rounded-2xl overflow-hidden flex flex-col max-h-screen sm:max-h-[90vh]">
                <div className="p-4 border-b flex justify-between items-center bg-white">
                  <h3 className="font-bold text-slate-900">Capturar IMEI / Serial</h3>
                  <button onClick={() => setShowOcrScanner(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <X className="w-6 h-6 text-slate-500" />
                  </button>
                </div>
                <div className="relative flex-1 bg-black overflow-hidden">
                  <video 
                    ref={ocrVideoRef} 
                    autoPlay 
                    playsInline 
                    className="w-full h-full object-cover"
                  />
                  <canvas ref={ocrCanvasRef} className="hidden" />
                  
                  {/* Overlay for guidance */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-[80%] h-20 border-2 border-dashed border-white/50 rounded-lg flex items-center justify-center">
                      <div className="w-full h-0.5 bg-red-500/70 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                    </div>
                  </div>

                  {isOcrLoading && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white z-10">
                      <Loader2 className="w-12 h-12 animate-spin mb-3 text-purple-400" />
                      <p className="text-sm font-bold tracking-wider uppercase">Processando texto...</p>
                    </div>
                  )}
                </div>
                <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-100 flex flex-col gap-3">
                  <p className="text-[11px] text-slate-500 text-center font-medium">
                    A leitura é automática! Centralize o IMEI ou Serial na linha vermelha.
                  </p>
                  <button 
                    onClick={captureAndOcr}
                    disabled={isOcrLoading}
                    className="w-full py-4 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-lg shadow-purple-200 disabled:opacity-50 disabled:shadow-none"
                  >
                    <Camera className="w-6 h-6" />
                    <span className="text-lg">{isOcrLoading ? 'PROCESSANDO...' : 'CAPTURAR MANUAL'}</span>
                  </button>
                  <button 
                    onClick={() => setShowOcrScanner(false)}
                    className="w-full py-2 text-slate-400 text-xs font-bold uppercase tracking-widest hover:text-slate-600 transition-colors sm:hidden"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>

        {/* Floating Action Button for Mobile */}
        <button 
          onClick={() => {
            setFormError(null);
            setShowForm(true);
          }}
          className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-300 flex items-center justify-center hover:bg-blue-700 transition-all active:scale-95 z-40 md:hidden"
        >
          <Plus className="w-8 h-8" />
        </button>
        <AnimatePresence>
          {deletePhoneId && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  setDeletePhoneId(null);
                  setDeletePassword('');
                }}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 text-center"
              >
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Confirmar Exclusão</h3>
                <p className="text-slate-500 text-sm mb-6">Para excluir este item, digite a senha de segurança.</p>
                
                <input 
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleDelete();
                  }}
                  placeholder="Digite a senha..."
                  className="w-full p-3 border border-slate-200 rounded-xl mb-4 focus:ring-2 focus:ring-red-500 outline-none"
                  autoFocus
                />

                <div className="flex gap-3">
                  <button 
                    onClick={() => {
                      setDeletePhoneId(null);
                      setDeletePassword('');
                    }}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                  >
                    {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Excluir'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <Toaster position="top-center" richColors />
      </div>
    </ErrorBoundary>
  );
}

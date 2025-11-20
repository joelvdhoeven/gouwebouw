import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerLocale } from 'react-datepicker';
import { nl } from 'date-fns/locale';
import App from './App.tsx';
import { LanguageProvider } from './contexts/LanguageContext';
import { AuthProvider } from './contexts/AuthContext';
import { SystemSettingsProvider } from './contexts/SystemSettingsContext';
import './index.css';

// Register Dutch locale for DatePicker
registerLocale('nl', nl);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <AuthProvider>
        <SystemSettingsProvider>
          <App />
        </SystemSettingsProvider>
      </AuthProvider>
    </LanguageProvider>
  </StrictMode>
);

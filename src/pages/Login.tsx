import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const Login: React.FC = () => {
  const { login } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      setError('Vul alle velden in');
      return;
    }

    console.log('=== LOGIN ATTEMPT START ===');
    console.log('Email:', email);

    setIsLoading(true);
    setError('');

    try {
      console.log('Calling login function...');
      await login(email, password);
      console.log('Login successful!');
    } catch (error: any) {
      console.log('=== LOGIN FAILED ===');
      console.log('Error object:', error);
      console.log('Error message:', error.message);
      const errorMessage = error.message || 'Gebruikersnaam of wachtwoord is niet goed';
      console.log('Setting error message:', errorMessage);
      setError(errorMessage);
      console.log('Error state set');
    } finally {
      console.log('Setting isLoading to false');
      setIsLoading(false);
      console.log('=== LOGIN ATTEMPT END ===');
    }
  };

  const languages = [
    { code: 'nl' as const, name: 'Nederlands', flag: '🇳🇱' },
    { code: 'en' as const, name: 'English', flag: '🇬🇧' },
    { code: 'pl' as const, name: 'Polski', flag: '🇵🇱' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <img src="/image copy copy.png" alt="GouweBouw" className="h-32" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">{t('welcomeToGouweBouw')}</h1>
          <p className="text-gray-600">{t('loginToContinue')}</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          {showForgotPassword && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Wachtwoord vergeten?</h3>
                <p className="text-gray-600 mb-4">
                  Neem contact op met een van de Admins <strong>Martin</strong> of <strong>Guido</strong> om je wachtwoord te veranderen.
                </p>
                <button
                  onClick={() => setShowForgotPassword(false)}
                  className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors"
                >
                  Sluiten
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('emailAddress')}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('emailPlaceholder')}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('password')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('passwordPlaceholder')}
                  className="w-full pl-10 pr-12 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>{t('loggingIn')}</span>
                </div>
              ) : (
                t('login')
              )}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-red-600 hover:text-red-700 underline"
              >
                Wachtwoord vergeten?
              </button>
            </div>
          </form>

          {/* Language Selection */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600 text-center mb-3">{t('selectLanguage')}</p>
            <div className="flex justify-center space-x-2">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setLanguage(lang.code)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm transition-colors ${
                    language === lang.code
                      ? 'bg-red-100 text-red-700 border border-red-300'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <span>{lang.flag}</span>
                  <span>{lang.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>


        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            © 2025 GouweBouw. {t('allRightsReserved')}
          </p>
          <div className="mt-2 text-xs text-gray-400">
            <span>{t('version')} 1.0.0</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

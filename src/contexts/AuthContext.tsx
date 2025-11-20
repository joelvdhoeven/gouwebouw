import React, { createContext, useContext, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { User, UserRole, AuthContextType } from '../types';

// Demo mode - bypasses Supabase auth for testing
const DEMO_MODE = false;
const DEMO_USER = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'demo@example.com',
  naam: 'Demo Gebruiker',
  role: 'admin' as const
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Define permissions for each role
const rolePermissions: Record<UserRole, string[]> = {
  admin: [
    'view_dashboard',
    'manage_users',
    'manage_projects',
    'manage_inventory',
    'manage_tools',
    'manage_returns',
    'view_reports',
    'manage_damage_reports',
    'view_damage_reports',
    'manage_notifications',
    'view_notifications',
    'manage_settings',
    'view_settings',
    'register_hours',
    'approve_hours',
    'export_data',
    'view_projects',
    'view_inventory',
    'view_tools',
    'create_tickets'
  ],
  kantoorpersoneel: [
    'view_dashboard',
    'manage_projects',
    'manage_inventory',
    'manage_tools',
    'manage_returns',
    'view_reports',
    'manage_damage_reports',
    'view_damage_reports',
    'register_hours',
    'view_notifications',
    'approve_hours',
    'manage_notifications',
    'export_data',
    'view_projects',
    'view_inventory',
    'view_tools',
    'create_tickets'
  ],
  medewerker: [
    'view_dashboard',
    'register_hours',
    'view_notifications',
    'view_damage_reports',
    'manage_damage_reports',
    'view_own_reports'
  ],
  zzper: [
    'view_dashboard',
    'register_hours',
    'view_notifications',
    'view_damage_reports',
    'manage_damage_reports',
    'view_own_reports'
  ],
  superuser: [
    'view_dashboard',
    'manage_users',
    'manage_projects',
    'manage_inventory',
    'manage_tools',
    'manage_returns',
    'view_reports',
    'manage_damage_reports',
    'view_damage_reports',
    'manage_notifications',
    'view_notifications',
    'manage_settings',
    'view_settings',
    'register_hours',
    'approve_hours',
    'export_data',
    'view_projects',
    'view_inventory',
    'view_tools',
    'create_tickets',
    'view_all_tickets'
  ]
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const login = async (email: string, password: string) => {
    console.log('[AuthContext] === LOGIN START ===');

    // Don't set loading true - this prevents App.tsx from thinking we have a user
    // setLoading(true);

    // Clear any existing session before attempting login
    await supabase.auth.signOut();
    setUser(null);
    localStorage.removeItem('currentUser');

    // Sign in with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });

    console.log('[AuthContext] Auth response:', { hasError: !!authError, errorMessage: authError?.message });

    if (authError) {
      console.log('[AuthContext] Login FAILED - throwing error');
      // Make sure we're signed out
      await supabase.auth.signOut();
      setUser(null);
      localStorage.removeItem('currentUser');

      if (authError.message === 'Invalid login credentials') {
        throw new Error('Gebruikersnaam of wachtwoord is niet goed');
      } else if (authError.message.includes('Email not confirmed')) {
        throw new Error('E-mail is nog niet bevestigd');
      } else if (authError.message.includes('User not found')) {
        throw new Error('Gebruiker niet gevonden');
      }

      throw new Error('Inloggen mislukt');
    }

    if (!authData.user?.id) {
      await supabase.auth.signOut();
      setUser(null);
      localStorage.removeItem('currentUser');
      throw new Error('Inloggen mislukt');
    }

    console.log('[AuthContext] Auth successful, fetching profile...');

    // Get user profile from database
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      await supabase.auth.signOut();
      throw new Error('Kan gebruikersprofiel niet ophalen');
    }

    if (!profile) {
      // Profile doesn't exist, create one
      const defaultName = authData.user.user_metadata?.name || authData.user.email?.split('@')[0] || 'User';
      const userRole = authData.user.user_metadata?.role || 'medewerker';

      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          naam: defaultName,
          email: authData.user.email || '',
          role: userRole
        })
        .select()
        .maybeSingle();

      if (createError || !newProfile) {
        console.error('Profile creation error:', createError);
        await supabase.auth.signOut();
        throw new Error('Kan gebruikersprofiel niet aanmaken');
      }

      const userWithProfile: User = {
        id: newProfile.id,
        naam: newProfile.naam,
        email: newProfile.email,
        role: newProfile.role
      };

      console.log('[AuthContext] Setting user state');
      setUser(userWithProfile);
      localStorage.setItem('currentUser', JSON.stringify(userWithProfile));
    } else {
      const userWithProfile: User = {
        id: profile.id,
        naam: profile.naam,
        email: profile.email,
        role: profile.role
      };

      console.log('[AuthContext] Setting user state');
      setUser(userWithProfile);
      localStorage.setItem('currentUser', JSON.stringify(userWithProfile));
    }

    console.log('[AuthContext] === LOGIN END ===');
  };

  const createOrUpdateProfile = async (userId: string, userData: User) => {
    if (!userId || userId.trim() === '') {
      console.error('Invalid user ID provided to createProfile');
      return;
    }

    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          naam: userData.naam,
          email: userData.email,
          role: userData.role
        });

      if (profileError) {
        console.error('Profile creation error:', profileError);
      }
    } catch (err) {
      console.error('Profile creation failed:', err);
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn('Supabase signOut failed, session might already be invalid:', error);
      // Continue with local state cleanup even if signOut fails on the server
    } finally {
      setUser(null);
      localStorage.removeItem('currentUser');
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    return rolePermissions[user.role]?.includes(permission) || false;
  };

  // Check for existing user on mount
  React.useEffect(() => {
    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          // Get user profile from database
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profileError && profileError.code === 'PGRST116') {
            // Profile doesn't exist, create one
            const defaultName = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User';
            const userRole = session.user.user_metadata?.role || 'medewerker';
            const { data: newProfile, error: createError } = await supabase
              .from('profiles')
              .insert({
                id: session.user.id,
                naam: defaultName,
                email: session.user.email || '',
                role: userRole
              })
              .select()
              .single();

            if (createError) {
              console.error('Profile creation error during session restore:', createError);
            } else if (newProfile) {
              const userData: User = {
                id: newProfile.id,
                naam: newProfile.naam,
                email: newProfile.email,
                role: newProfile.role
              };
              setUser(userData);
              localStorage.setItem('currentUser', JSON.stringify(userData));
            }
          } else if (profileError) {
            console.error('Profile fetch error during session restore:', profileError);
          } else if (profile) {
            const userData: User = {
              id: profile.id,
              naam: profile.naam,
              email: profile.email,
              role: profile.role
            };
            setUser(userData);
            localStorage.setItem('currentUser', JSON.stringify(userData));
          }
        }
      } catch (error) {
        console.error('Session check error:', error);
      } finally {
        setLoading(false);
      }
    };

    getSession();

    // Listen for auth changes - ONLY handle sign out
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AuthContext] Auth state changed:', event);
      if (event === 'SIGNED_OUT') {
        console.log('[AuthContext] User signed out, clearing state');
        setUser(null);
        localStorage.removeItem('currentUser');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Laden...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, profile: user, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};
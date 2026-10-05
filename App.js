import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  Alert,
  StatusBar,
  Modal,
  ScrollView,
  Switch,
  Clipboard,
  AppState,
  PanResponder,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'passwords_key_v1';
const MASTER_KEY = 'master_password_v1';
const THEME_KEY = 'theme_mode_v1';
const INACTIVITY_TIMEOUT = 3 * 60 * 1000; // Auto-Lock nach 3 Minuten Inaktivität
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000; // 1 Jahr in Millisekunden

// --- ENCRYPTION AT REST (XOR + Base64 Hilfsfunktionen) ---
const encryptData = (text, key) => {
  if (!key) return text;
  try {
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return 'ENC:' + btoa(result);
  } catch (e) {
    return text;
  }
};

const decryptData = (text, key) => {
  if (!key || !text || !text.startsWith('ENC:')) return text;
  try {
    const raw = atob(text.replace('ENC:', ''));
    let result = '';
    for (let i = 0; i < raw.length; i++) {
      result += String.fromCharCode(raw.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  } catch (e) {
    return text;
  }
};

// --- PASSWORT-ANALYSE HILFSFUNKTION ---
const getPasswordStrength = (pwd) => {
  if (!pwd) return { score: 0, label: 'Unbekannt', color: '#888' };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;

  if (score <= 2) return { score, label: 'Schwach', color: '#EF4444' };
  if (score <= 4) return { score, label: 'Mittel', color: '#F59E0B' };
  if (score === 5) return { score, label: 'Stark', color: '#10B981' };
  return { score, label: 'Sehr Stark', color: '#059669' };
};

// --- HILFSFUNKTION FÜR PASSWORT-ALTER ---
const isPasswordOlderThanOneYear = (createdAt, id) => {
  const createdTime = createdAt || (Number(id) ? Number(id) : null);
  if (!createdTime) return false;
  return Date.now() - createdTime > ONE_YEAR_MS;
};

export default function App() {
  // Passwörter-State
  const [passwords, setPasswords] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPasswordId, setShowPasswordId] = useState(null);

  // States für Bearbeiten, Dark Mode, Master-Passwort & Entwickler-Info
  const [editingId, setEditingId] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Master-Passwort States
  const [savedMasterPw, setSavedMasterPw] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [masterInput, setMasterInput] = useState('');
  const [newMasterInput, setNewMasterInput] = useState('');
  const [confirmMasterInput, setConfirmMasterInput] = useState('');
  const [showMasterSettings, setShowMasterSettings] = useState(false);

  // Entwickler-Info Modal State
  const [showDevInfo, setShowDevInfo] = useState(false);

  // Backup Modal State & Input
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backupInputText, setBackupInputText] = useState('');

  // SUCHLEISTE & FILTER
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');

  // GENERATOR OPTIONEN
  const [genLength, setGenLength] = useState(16);
  const [genIncludeUpper, setGenIncludeUpper] = useState(true);
  const [genIncludeLower, setGenIncludeLower] = useState(true);
  const [genIncludeNumbers, setGenIncludeNumbers] = useState(true);
  const [genIncludeSymbols, setGenIncludeSymbols] = useState(true);
  const [showGenSettings, setShowGenSettings] = useState(false);

  // GESUNDHEITS-CHECK MODAL
  const [showHealthCheck, setShowHealthCheck] = useState(false);

  // AUTO-LOCK & INAKTIVITÄTS-TIMER
  const timerRef = useRef(null);
  const activeMasterPwRef = useRef(savedMasterPw);
  activeMasterPwRef.current = savedMasterPw;

  const resetInactivityTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (isAuthenticated) {
      timerRef.current = setTimeout(() => {
        handleLockApp();
      }, INACTIVITY_TIMEOUT);
    }
  };

  const handleLockApp = () => {
    setIsAuthenticated(false);
    setPasswords([]);
    setShowPasswordId(null);
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState.match(/inactive|background/)) {
        handleLockApp();
      }
    });
    return () => subscription.remove();
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => {
        resetInactivityTimer();
        return false;
      },
    })
  ).current;

  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    await loadTheme();
    await checkMasterPassword();
  };

  // --- THEME SPEICHERUNG (SECURE STORE) ---
  const loadTheme = async () => {
    try {
      const savedTheme = await SecureStore.getItemAsync(THEME_KEY);
      if (savedTheme !== null) {
        setIsDarkMode(savedTheme === 'dark');
      }
    } catch (e) {
      console.log('Fehler beim Laden des Themes');
    }
  };

  const toggleTheme = async () => {
    try {
      const nextMode = !isDarkMode;
      setIsDarkMode(nextMode);
      await SecureStore.setItemAsync(THEME_KEY, nextMode ? 'dark' : 'light');
    } catch (e) {
      console.log('Fehler beim Speichern des Themes');
    }
  };

  // --- MASTER-PASSWORT LOGIK (SECURE STORE) ---
  const checkMasterPassword = async () => {
    try {
      const master = await SecureStore.getItemAsync(MASTER_KEY);
      if (master) {
        setSavedMasterPw(master);
        setIsAuthenticated(false);
      } else {
        setIsAuthenticated(false);
      }
    } catch (e) {
      console.log('Fehler beim Laden des Master-Passworts');
    }
  };

  const handleSetupMasterPassword = async () => {
    if (!newMasterInput.trim()) {
      Alert.alert('Fehler', 'Bitte gib ein Master-Passwort ein.');
      return;
    }
    if (newMasterInput !== confirmMasterInput) {
      Alert.alert('Fehler', 'Die eingegebenen Passwörter stimmen nicht überein.');
      return;
    }
    try {
      const masterKey = newMasterInput.trim();
      await SecureStore.setItemAsync(MASTER_KEY, masterKey);
      setSavedMasterPw(masterKey);
      setIsAuthenticated(true);
      setNewMasterInput('');
      setConfirmMasterInput('');
      loadPasswords(masterKey);
      resetInactivityTimer();
      Alert.alert('Erfolg', 'Master-Passwort erfolgreich eingerichtet!');
    } catch (e) {
      Alert.alert('Fehler', 'Master-Passwort konnte nicht gespeichert werden.');
    }
  };

  const handleLogin = () => {
    if (masterInput === savedMasterPw) {
      setIsAuthenticated(true);
      const currentMaster = savedMasterPw;
      setMasterInput('');
      loadPasswords(currentMaster);
      resetInactivityTimer();
    } else {
      Alert.alert('Zugriff verweigert', 'Falsches Master-Passwort.');
    }
  };

  const handleChangeMasterPassword = async () => {
    if (!newMasterInput.trim()) {
      Alert.alert('Fehler', 'Bitte gib ein neues Passwort ein.');
      return;
    }
    if (newMasterInput !== confirmMasterInput) {
      Alert.alert('Fehler', 'Die Passwörter stimmen nicht überein.');
      return;
    }
    try {
      const newMaster = newMasterInput.trim();
      
      const reEncryptedPasswords = passwords.map((p) => ({
        ...p,
      }));
      
      await SecureStore.setItemAsync(MASTER_KEY, newMaster);
      setSavedMasterPw(newMaster);
      await savePasswordsToStorage(reEncryptedPasswords, newMaster);

      setNewMasterInput('');
      setConfirmMasterInput('');
      setShowMasterSettings(false);
      Alert.alert('Erfolg', 'Master-Passwort wurde geändert.');
    } catch (e) {
      Alert.alert('Fehler', 'Änderung konnte nicht gespeichert werden.');
    }
  };

  // --- PASSWORT SPEICHERUNG & LADEN (SECURE STORE) ---
  const loadPasswords = async (masterKey = savedMasterPw) => {
    try {
      const jsonValue = await SecureStore.getItemAsync(STORAGE_KEY);
      if (jsonValue != null) {
        const rawList = JSON.parse(jsonValue);
        const decryptedList = rawList.map((item) => ({
          ...item,
          password: decryptData(item.password, masterKey),
        }));
        setPasswords(decryptedList);
      }
    } catch (e) {
      Alert.alert('Fehler', 'Passwörter konnten nicht geladen werden.');
    }
  };

  const savePasswordsToStorage = async (newPasswords, masterKey = savedMasterPw) => {
    try {
      const encryptedList = newPasswords.map((item) => ({
        ...item,
        password: encryptData(item.password, masterKey),
      }));
      const jsonValue = JSON.stringify(encryptedList);
      await SecureStore.setItemAsync(STORAGE_KEY, jsonValue);
    } catch (e) {
      Alert.alert('Fehler', 'Passwort konnte nicht gespeichert werden.');
    }
  };

  // --- BACKUP-FUNKTIONEN (EXPORT & IMPORT) ---
  const handleExportBackup = async () => {
    try {
      if (passwords.length === 0) {
        Alert.alert('Hinweis', 'Es sind keine Passwörter zum Sichern vorhanden.');
        return;
      }
      const jsonValue = JSON.stringify(passwords, null, 2);
      Clipboard.setString(jsonValue);
      Alert.alert(
        'Backup Exportiert',
        'Deine gesicherten Passwörter wurden im JSON-Format in die Zwischenablage kopiert. Speichere diesen Text an einem sicheren Ort.'
      );
    } catch (e) {
      Alert.alert('Fehler', 'Backup konnte nicht erstellt werden.');
    }
  };

  const handleImportBackup = () => {
    if (!backupInputText.trim()) {
      Alert.alert('Fehler', 'Bitte füge den Backup-Code im Textfeld ein.');
      return;
    }

    try {
      const parsedData = JSON.parse(backupInputText.trim());

      if (!Array.isArray(parsedData)) {
        Alert.alert('Fehler', 'Das angegebene Backup hat kein gültiges Format.');
        return;
      }

      const isValid = parsedData.every(
        (item) => item.id && item.title !== undefined && item.password !== undefined
      );

      if (!isValid) {
        Alert.alert('Fehler', 'Der Backup-Inhalt entspricht nicht der erforderlichen Datenstruktur.');
        return;
      }

      Alert.alert(
        'Backup Wiederherstellen',
        'Möchtest du bestehende Einträge überschreiben oder die Daten zusammenführen?',
        [
          { text: 'Abbrechen', style: 'cancel' },
          {
            text: 'Zusammenführen',
            onPress: async () => {
              const existingIds = new Set(passwords.map((p) => p.id));
              const filteredNew = parsedData.filter((item) => !existingIds.has(item.id));
              const merged = [...passwords, ...filteredNew];

              setPasswords(merged);
              await savePasswordsToStorage(merged);
              setBackupInputText('');
              setShowBackupModal(false);
              Alert.alert('Erfolg', 'Backup wurde erfolgreich zusammengeführt!');
            },
          },
          {
            text: 'Überschreiben',
            style: 'destructive',
            onPress: async () => {
              setPasswords(parsedData);
              await savePasswordsToStorage(parsedData);
              setBackupInputText('');
              setShowBackupModal(false);
              Alert.alert('Erfolg', 'Backup wurde erfolgreich wiederhergestellt!');
            },
          },
        ]
      );
    } catch (e) {
      Alert.alert('Fehler', 'Ungültiger Backup-Code (JSON Syntaxfehler).');
    }
  };

  // --- HINZUFÜGEN & BEARBEITEN ---
  const openAddModal = () => {
    setEditingId(null);
    setTitle('');
    setUsername('');
    setPassword('');
    setShowGenSettings(false);
    setModalVisible(true);
  };

  const openEditModal = (item) => {
    setEditingId(item.id);
    setTitle(item.title);
    setUsername(item.username || '');
    setPassword(item.password);
    setShowGenSettings(false);
    setModalVisible(true);
  };

  const handleAddOrUpdatePassword = () => {
    if (!title.trim() || !password.trim()) {
      Alert.alert('Hinweis', 'Bitte mindestens Titel und Passwort eingeben.');
      return;
    }

    let updatedPasswords;
    const now = Date.now();

    if (editingId) {
      updatedPasswords = passwords.map((item) => {
        if (item.id === editingId) {
          return {
            ...item,
            title: title.trim(),
            username: username.trim(),
            password: password.trim(),
            createdAt: now,
          };
        }
        return item;
      });
    } else {
      const newEntry = {
        id: now.toString(),
        title: title.trim(),
        username: username.trim(),
        password: password.trim(),
        createdAt: now,
      };
      updatedPasswords = [newEntry, ...passwords];
    }

    setPasswords(updatedPasswords);
    savePasswordsToStorage(updatedPasswords);

    setTitle('');
    setUsername('');
    setPassword('');
    setEditingId(null);
    setModalVisible(false);
  };

  const handleDeletePassword = (id) => {
    Alert.alert(
      'Löschen bestätigen',
      'Möchtest du diesen Eintrag wirklich löschen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: () => {
            const updated = passwords.filter((item) => item.id !== id);
            setPasswords(updated);
            savePasswordsToStorage(updated);
          },
        },
      ]
    );
  };

  // --- PASSWORT-GENERATOR ---
  const generatePassword = () => {
    let uppers = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let lowers = 'abcdefghijklmnopqrstuvwxyz';
    let numbers = '0123456789';
    let symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    let validChars = '';
    if (genIncludeUpper) validChars += uppers;
    if (genIncludeLower) validChars += lowers;
    if (genIncludeNumbers) validChars += numbers;
    if (genIncludeSymbols) validChars += symbols;

    if (!validChars) {
      Alert.alert('Fehler', 'Bitte wähle mindestens eine Zeichenkategorie aus.');
      return;
    }

    let result = '';
    for (let i = 0; i < genLength; i++) {
      result += validChars.charAt(Math.floor(Math.random() * validChars.length));
    }
    setPassword(result);
  };

  // --- KOPIER-FUNKTIONEN ---
  const copyToClipboard = (text, typeLabel) => {
    Clipboard.setString(text);
    Alert.alert('Kopiert', `${typeLabel} wurde in die Zwischenablage kopiert.`);
  };

  // --- GESUNDHEITS-CHECK METRIKEN ---
  const getHealthMetrics = () => {
    const total = passwords.length;
    let weakCount = 0;
    let reusedCount = 0;
    const pwdMap = {};

    passwords.forEach((p) => {
      const strength = getPasswordStrength(p.password);
      if (strength.score <= 2) weakCount++;
      pwdMap[p.password] = (pwdMap[p.password] || 0) + 1;
    });

    Object.values(pwdMap).forEach((count) => {
      if (count > 1) reusedCount += count;
    });

    const scorePercentage = total > 0 ? Math.round(((total - weakCount) / total) * 100) : 100;

    return { total, weakCount, reusedCount, scorePercentage };
  };

  // --- GEFILTERTE LISTE BERECHNEN ---
  const getFilteredPasswords = () => {
    const counts = {};
    passwords.forEach((p) => {
      counts[p.password] = (counts[p.password] || 0) + 1;
    });

    return passwords.filter((item) => {
      const matchesSearch =
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.username && item.username.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (filterType === 'weak') {
        return getPasswordStrength(item.password).score <= 2;
      }
      if (filterType === 'reused') {
        return counts[item.password] > 1;
      }

      return true;
    });
  };

  // --- FARBSCHEMA DYNAMISCH ---
  const colors = isDarkMode
    ? {
        bg: '#121212',
        card: '#1E1E1E',
        text: '#FFFFFF',
        subtext: '#AAAAAA',
        inputBg: '#2A2A2A',
        inputText: '#FFFFFF',
        border: '#333333',
        primary: '#007ACC',
        accent: '#4CAF50',
        danger: '#FF5252',
        placeholder: '#666666',
        warningBg: '#3A2A1A',
        warningText: '#F59E0B',
      }
    : {
        bg: '#F4F6F9',
        card: '#FFFFFF',
        text: '#111827',
        subtext: '#6B7280',
        inputBg: '#F3F4F6',
        inputText: '#111827',
        border: '#E5E7EB',
        primary: '#2563EB',
        accent: '#10B981',
        danger: '#EF4444',
        placeholder: '#9CA3AF',
        warningBg: '#FEF3C7',
        warningText: '#D97706',
      };

  // --- LOGIN / SETUP SCREEN ---
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
          backgroundColor={colors.bg}
        />
        <View style={styles.authContainer}>
          <Text style={[styles.authTitle, { color: colors.text }]}>
            {savedMasterPw ? '🔒 App Gesperrt' : '🛡️ Master-Passwort Erstellen'}
          </Text>
          <Text style={[styles.authSubtext, { color: colors.subtext }]}>
            {savedMasterPw
              ? 'Gib dein Master-Passwort ein, um fortzufahren.'
              : 'Erstelle ein Master-Passwort, um deine Passwörter zu schützen.'}
          </Text>

          {!savedMasterPw ? (
            <>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText }]}
                placeholder="Neues Master-Passwort"
                placeholderTextColor={colors.placeholder}
                secureTextEntry
                value={newMasterInput}
                onChangeText={setNewMasterInput}
              />
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText }]}
                placeholder="Passwort bestätigen"
                placeholderTextColor={colors.placeholder}
                secureTextEntry
                value={confirmMasterInput}
                onChangeText={setConfirmMasterInput}
              />
              <TouchableOpacity
                style={[styles.fullButton, { backgroundColor: colors.primary }]}
                onPress={handleSetupMasterPassword}
              >
                <Text style={styles.fullButtonText}>Einrichten & Starten</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText }]}
                placeholder="Master-Passwort"
                placeholderTextColor={colors.placeholder}
                secureTextEntry
                value={masterInput}
                onChangeText={setMasterInput}
              />
              <TouchableOpacity
                style={[styles.fullButton, { backgroundColor: colors.primary }]}
                onPress={handleLogin}
              >
                <Text style={styles.fullButtonText}>Entsperren</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={styles.devFooterButton}
            onPress={() => setShowDevInfo(true)}
          >
            <Text style={[styles.devFooterText, { color: colors.subtext }]}>
              Entwickler-Info: Özgür Cetin
            </Text>
          </TouchableOpacity>
        </View>

        <Modal visible={showDevInfo} animationType="fade" transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Entwickler-Information</Text>
              <View style={styles.devBox}>
                <Text style={[styles.devLabel, { color: colors.subtext }]}>Entwickler:</Text>
                <Text style={[styles.devValue, { color: colors.text }]}>Özgür Cetin</Text>
                <Text style={[styles.devLabel, { color: colors.subtext, marginTop: 10 }]}>E-Mail:</Text>
                <Text style={[styles.devValue, { color: colors.primary }]}>ozgur.cetin@web.de</Text>
              </View>
              <TouchableOpacity
                style={[styles.fullButton, { backgroundColor: colors.primary, marginTop: 20 }]}
                onPress={() => setShowDevInfo(false)}
              >
                <Text style={styles.fullButtonText}>Schließen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  const filteredPasswords = getFilteredPasswords();
  const healthMetrics = getHealthMetrics();

  // --- MAIN APP SCREEN ---
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} {...panResponder.panHandlers}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={colors.card}
      />

      {/* HEADER */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <Text
            style={[styles.headerTitle, { color: colors.text }]}
            numberOfLines={1}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.7}
          >
            Passwort-Manager
          </Text>
          <TouchableOpacity onPress={() => setShowDevInfo(true)}>
            <Text style={[styles.headerSubTitle, { color: colors.primary }]}>ⓘ Info</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: colors.inputBg }]}
            onPress={() => setShowHealthCheck(true)}
          >
            <Text style={{ fontSize: 15 }}>🩺</Text>
          </TouchableOpacity>

          <View style={styles.themeToggleContainer}>
            <Text style={{ fontSize: 12, color: colors.subtext, marginRight: 2 }}>
              {isDarkMode ? '🌙' : '☀️️'}
            </Text>
            <Switch
              value={isDarkMode}
              onValueChange={toggleTheme}
              trackColor={{ false: '#D1D5DB', true: '#3B82F6' }}
              thumbColor={isDarkMode ? '#60A5FA' : '#F3F4F6'}
            />
          </View>

          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: colors.inputBg }]}
            onPress={() => setShowBackupModal(true)}
          >
            <Text style={{ fontSize: 15 }}>💾</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: colors.inputBg }]}
            onPress={() => setShowMasterSettings(true)}
          >
            <Text style={{ fontSize: 15 }}>🔑</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            onPress={openAddModal}
          >
            <Text style={styles.addButtonText}>+ Neu</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* SUCHLEISTE & FILTER BAR */}
      <View style={[styles.searchContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TextInput
          style={[styles.searchInput, { backgroundColor: colors.inputBg, color: colors.inputText }]}
          placeholder="🔍 Suchen nach Titel oder Benutzer..."
          placeholderTextColor={colors.placeholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <View style={styles.filterChipsRow}>
          <TouchableOpacity
            style={[
              styles.chip,
              filterType === 'all' && { backgroundColor: colors.primary },
              filterType !== 'all' && { backgroundColor: colors.inputBg },
            ]}
            onPress={() => setFilterType('all')}
          >
            <Text style={[styles.chipText, { color: filterType === 'all' ? '#FFF' : colors.text }]}>
              Alle ({passwords.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.chip,
              filterType === 'weak' && { backgroundColor: colors.danger },
              filterType !== 'weak' && { backgroundColor: colors.inputBg },
            ]}
            onPress={() => setFilterType('weak')}
          >
            <Text style={[styles.chipText, { color: filterType === 'weak' ? '#FFF' : colors.text }]}>
              ⚠️ Schwach ({healthMetrics.weakCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.chip,
              filterType === 'reused' && { backgroundColor: '#F59E0B' },
              filterType !== 'reused' && { backgroundColor: colors.inputBg },
            ]}
            onPress={() => setFilterType('reused')}
          >
            <Text style={[styles.chipText, { color: filterType === 'reused' ? '#FFF' : colors.text }]}>
              🔄 Doppelt ({healthMetrics.reusedCount})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* CONTENT LIST */}
      {filteredPasswords.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.text }]}>
            {passwords.length === 0 ? 'Keine Passwörter gespeichert.' : 'Keine Passwörter gefunden.'}
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.subtext }]}>
            {passwords.length === 0 ? 'Tippe auf "+ Neu", um einen Eintrag zu erstellen.' : 'Passe deinen Filter oder Suchbegriff an.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredPasswords}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isVisible = showPasswordId === item.id;
            const strength = getPasswordStrength(item.password);
            const isExpired = isPasswordOlderThanOneYear(item.createdAt, item.id);

            return (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <View style={[styles.strengthBadge, { backgroundColor: strength.color }]}>
                      <Text style={styles.strengthBadgeText}>{strength.label}</Text>
                    </View>
                  </View>

                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      onPress={() => openEditModal(item)}
                      style={[styles.iconActionButton, { backgroundColor: colors.inputBg }]}
                      accessibilityLabel="Bearbeiten"
                    >
                      <Text style={{ fontSize: 14 }}>✏</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeletePassword(item.id)}
                      style={[styles.iconActionButton, { backgroundColor: isDarkMode ? '#3A1C1C' : '#FEE2E2' }]}
                      accessibilityLabel="Löschen"
                    >
                      <Text style={{ fontSize: 14 }}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {isExpired && (
                  <TouchableOpacity 
                    style={[styles.expiredBanner, { backgroundColor: colors.warningBg }]}
                    onPress={() => openEditModal(item)}
                  >
                    <Text style={[styles.expiredBannerText, { color: colors.warningText }]}>
                      ⚠️ Passwort vor &gt;1 Jahr erstellt – bitte erneuern!
                    </Text>
                  </TouchableOpacity>
                )}

                {item.username ? (
                  <View style={styles.userRow}>
                    <Text style={[styles.cardUser, { color: colors.subtext }]} numberOfLines={1}>
                      Benutzer: {item.username}
                    </Text>
                    <TouchableOpacity
                      onPress={() => copyToClipboard(item.username, 'Benutzername')}
                      style={[styles.copyIconBtn, { backgroundColor: colors.inputBg }]}
                    >
                      <Text style={{ fontSize: 13 }}>📋</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                <View style={[styles.passwordRow, { backgroundColor: colors.inputBg }]}>
                  <Text style={[styles.cardPassword, { color: colors.accent }]} numberOfLines={1}>
                    {isVisible ? item.password : '••••••••••••'}
                  </Text>
                  
                  <View style={styles.passwordActions}>
                    <TouchableOpacity
                      onPress={() => copyToClipboard(item.password, 'Passwort')}
                      style={[styles.copyIconBtn, { backgroundColor: colors.card }]}
                    >
                      <Text style={{ fontSize: 13 }}>📋</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setShowPasswordId(isVisible ? null : item.id)}
                      style={[styles.copyIconBtn, { backgroundColor: colors.card }]}
                    >
                      <Text style={{ fontSize: 13 }}>{isVisible ? '🙈' : '👁️'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* FOOTER */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Text style={[styles.footerText, { color: colors.subtext }]}>
          Entwickelt von <Text style={{ fontWeight: 'bold', color: colors.text }}>Özgür Cetin</Text> | ozgur.cetin@web.de
        </Text>
      </View>

      {/* MODAL: GESUNDHEITS-CHECK */}
      <Modal visible={showHealthCheck} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>🩺 Passwort-Gesundheit</Text>

            <View style={[styles.healthScoreCard, { backgroundColor: colors.inputBg }]}>
              <Text style={[styles.healthScoreText, { color: colors.primary }]}>
                {healthMetrics.scorePercentage}%
              </Text>
              <Text style={{ color: colors.subtext, fontSize: 12 }}>Gesamtsicherheits-Score</Text>
            </View>

            <View style={styles.healthStatsRow}>
              <View style={styles.statBox}>
                <Text style={[styles.statNumber, { color: colors.text }]}>{healthMetrics.total}</Text>
                <Text style={[styles.statLabel, { color: colors.subtext }]}>Gesamt</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statNumber, { color: colors.danger }]}>{healthMetrics.weakCount}</Text>
                <Text style={[styles.statLabel, { color: colors.subtext }]}>Schwach</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statNumber, { color: '#F59E0B' }]}>{healthMetrics.reusedCount}</Text>
                <Text style={[styles.statLabel, { color: colors.subtext }]}>Doppelt</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.fullButton, { backgroundColor: colors.primary, marginTop: 15 }]}
              onPress={() => setShowHealthCheck(false)}
            >
              <Text style={styles.fullButtonText}>Schließen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: HINZUFÜGEN / BEARBEITEN */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingId ? 'Eintrag Bearbeiten' : 'Neuer Eintrag'}
            </Text>

            <Text style={[styles.label, { color: colors.subtext }]}>Titel / Dienst</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText }]}
              placeholder="z.B. Google, GitHub..."
              placeholderTextColor={colors.placeholder}
              value={title}
              onChangeText={setTitle}
            />

            <Text style={[styles.label, { color: colors.subtext }]}>Benutzername / E-Mail</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText }]}
              placeholder="z.B. max@example.com"
              placeholderTextColor={colors.placeholder}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />

            <Text style={[styles.label, { color: colors.subtext }]}>Passwort</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText }]}
              placeholder="Passwort eingeben"
              placeholderTextColor={colors.placeholder}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={false}
            />

            <TouchableOpacity
              style={{ marginBottom: 10 }}
              onPress={() => setShowGenSettings(!showGenSettings)}
            >
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>
                {showGenSettings ? '⚙️ Generator-Optionen verbergen' : '⚙️ Generator-Optionen anzeigen'}
              </Text>
            </TouchableOpacity>

            {showGenSettings && (
              <View style={[styles.genSettingsContainer, { backgroundColor: colors.inputBg }]}>
                <Text style={[styles.label, { color: colors.text }]}>Länge: {genLength}</Text>
                <View style={styles.lengthBtnRow}>
                  {[8, 12, 16, 20, 24].map((len) => (
                    <TouchableOpacity
                      key={len}
                      style={[
                        styles.lengthBtn,
                        genLength === len && { backgroundColor: colors.primary },
                      ]}
                      onPress={() => setGenLength(len)}
                    >
                      <Text style={{ color: genLength === len ? '#FFF' : colors.text, fontSize: 12 }}>
                        {len}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.switchRow}>
                  <Text style={{ color: colors.text, fontSize: 13 }}>Großbuchstaben (A-Z)</Text>
                  <Switch value={genIncludeUpper} onValueChange={setGenIncludeUpper} />
                </View>
                <View style={styles.switchRow}>
                  <Text style={{ color: colors.text, fontSize: 13 }}>Kleinbuchstaben (a-z)</Text>
                  <Switch value={genIncludeLower} onValueChange={setGenIncludeLower} />
                </View>
                <View style={styles.switchRow}>
                  <Text style={{ color: colors.text, fontSize: 13 }}>Zahlen (0-9)</Text>
                  <Switch value={genIncludeNumbers} onValueChange={setGenIncludeNumbers} />
                </View>
                <View style={styles.switchRow}>
                  <Text style={{ color: colors.text, fontSize: 13 }}>Sonderzeichen (!@#$)</Text>
                  <Switch value={genIncludeSymbols} onValueChange={setGenIncludeSymbols} />
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[styles.generateButton, { borderColor: colors.primary }]}
              onPress={generatePassword}
            >
              <Text style={[styles.generateButtonText, { color: colors.primary }]}>
                Sicheres Passwort generieren
              </Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.inputBg }]}
                onPress={() => {
                  setModalVisible(false);
                  setEditingId(null);
                }}
              >
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Abbrechen</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                onPress={handleAddOrUpdatePassword}
              >
                <Text style={[styles.modalBtnText, { color: '#FFF' }]}>Speichern</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* MODAL: BACKUP */}
      <Modal visible={showBackupModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Backup & Wiederherstellung
            </Text>

            <TouchableOpacity
              style={[styles.fullButton, { backgroundColor: colors.primary, marginBottom: 16 }]}
              onPress={handleExportBackup}
            >
              <Text style={styles.fullButtonText}>📥 Backup in Zwischenablage kopieren</Text>
            </TouchableOpacity>

            <Text style={[styles.label, { color: colors.subtext }]}>Backup-Text zum Importieren fügen:</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBg,
                  color: colors.inputText,
                  height: 90,
                  textAlignVertical: 'top',
                },
              ]}
              placeholder="JSON Backup hier einfügen..."
              placeholderTextColor={colors.placeholder}
              multiline={true}
              value={backupInputText}
              onChangeText={setBackupInputText}
            />

            <TouchableOpacity
              style={[styles.fullButton, { backgroundColor: colors.accent, marginBottom: 16 }]}
              onPress={handleImportBackup}
            >
              <Text style={styles.fullButtonText}>📤 Backup Wiederherstellen</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.fullButton, { backgroundColor: colors.inputBg }]}
              onPress={() => {
                setShowBackupModal(false);
                setBackupInputText('');
              }}
            >
              <Text style={[styles.modalBtnText, { color: colors.text }]}>Schließen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: MASTER-PASSWORT ÄNDERN */}
      <Modal visible={showMasterSettings} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Master-Passwort Ändern
            </Text>

            <Text style={[styles.label, { color: colors.subtext }]}>Neues Passwort</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText }]}
              placeholder="Neues Passwort"
              placeholderTextColor={colors.placeholder}
              secureTextEntry
              value={newMasterInput}
              onChangeText={setNewMasterInput}
            />

            <Text style={[styles.label, { color: colors.subtext }]}>Bestätigen</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText }]}
              placeholder="Bestätigen"
              placeholderTextColor={colors.placeholder}
              secureTextEntry
              value={confirmMasterInput}
              onChangeText={setConfirmMasterInput}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.inputBg }]}
                onPress={() => {
                  setShowMasterSettings(false);
                  setNewMasterInput('');
                  setConfirmMasterInput('');
                }}
              >
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Abbrechen</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                onPress={handleChangeMasterPassword}
              >
                <Text style={[styles.modalBtnText, { color: '#FFF' }]}>Ändern</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: ENTWICKLER INFO */}
      <Modal visible={showDevInfo} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Entwickler-Information</Text>
            <View style={styles.devBox}>
              <Text style={[styles.devLabel, { color: colors.subtext }]}>Entwickler:</Text>
              <Text style={[styles.devValue, { color: colors.text }]}>Özgür Cetin</Text>
              <Text style={[styles.devLabel, { color: colors.subtext, marginTop: 10 }]}>E-Mail:</Text>
              <Text style={[styles.devValue, { color: colors.primary }]}>ozgur.cetin@web.de</Text>
            </View>
            <TouchableOpacity
              style={[styles.fullButton, { backgroundColor: colors.primary, marginTop: 20 }]}
              onPress={() => setShowDevInfo(false)}
            >
              <Text style={styles.fullButtonText}>Schließen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flex: 1,
    marginRight: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  headerSubTitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  themeToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 2,
  },
  iconButton: {
    padding: 6,
    borderRadius: 8,
    marginRight: 3,
  },
  addButton: {
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  searchContainer: {
    padding: 10,
    borderBottomWidth: 1,
  },
  searchInput: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    marginBottom: 8,
  },
  filterChipsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
  },
  listContent: {
    padding: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 6,
    maxWidth: '60%',
  },
  strengthBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  strengthBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  expiredBanner: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  expiredBannerText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconActionButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardUser: {
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  passwordRow: {
    flexDirection: 'row',
    justify.Content: 'space-between',
    alignItems: 'center',
    padding: 8,
    paddingLeft: 12,
    borderRadius: 8,
  },
  cardPassword: {
    fontFamily: 'monospace',
    fontSize: 15,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 8,
  },
  passwordActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  copyIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  label: {
    marginBottom: 6,
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
    fontSize: 16,
  },
  genSettingsContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  lengthBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  lengthBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CCC',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  generateButton: {
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
  },
  generateButtonText: {
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalBtn: {
    flex: 0.48,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalBtnText: {
    fontWeight: 'bold',
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  authTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  authSubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  fullButton: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  fullButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  devFooterButton: {
    marginTop: 30,
    alignItems: 'center',
  },
  devFooterText: {
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  devBox: {
    padding: 12,
    borderRadius: 8,
  },
  devLabel: {
    fontSize: 12,
  },
  devValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    padding: 10,
    alignItems: 'center',
    borderTopWidth: 1,
  },
  footerText: {
    fontSize: 11,
  },
  healthScoreCard: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  healthScoreText: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  healthStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
  },
});

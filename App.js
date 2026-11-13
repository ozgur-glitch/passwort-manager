import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Switch,
  Alert,
  Linking,
  Clipboard,
  Platform,
  BackHandler
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function App() {
  const [isLocked, setIsLocked] = useState(true);
  const [autoLockMinutes, setAutoLockMinutes] = useState('5');
  const inactivityTimerRef = useRef(null);

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [passwords, setPasswords] = useState([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeAuditFilter, setActiveAuditFilter] = useState(null);
  const [expandedIds, setExpandedIds] = useState({});

  const [genLength, setGenLength] = useState('14');
  const [useSymbols, setUseSymbols] = useState(true);
  const [useNumbers, setUseNumbers] = useState(true);
  const [useUppercase, setUseUppercase] = useState(true);

  const [settingsTab, setSettingsTab] = useState('security');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [showPasswordId, setShowPasswordId] = useState(null);

  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [backupPassword, setBackupPassword] = useState('');
  const [backupActionType, setBackupActionType] = useState(null);
  const [pendingImportUri, setPendingImportUri] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [link, setLink] = useState('');
  const [lastChangedInput, setLastChangedInput] = useState('');
  const [subTasks, setSubTasks] = useState([]);

  const usernameRef = useRef(null);
  const linkRef = useRef(null);
  const dateRef = useRef(null);
  const passwordRef = useRef(null);

  const theme = isDarkMode ? darkTheme : lightTheme;

  useEffect(() => {
    loadStoredData();
  }, []);

  const loadStoredData = async () => {
    try {
      const storedPasswords = await AsyncStorage.getItem('@passwords_key');
      const storedAutoLock = await AsyncStorage.getItem('@autolock_key');
      const storedDarkMode = await AsyncStorage.getItem('@darkmode_key');

      if (storedPasswords) {
        setPasswords(JSON.parse(storedPasswords));
      } else {
        const initialDefault = [
          { 
            id: '1', 
            title: 'E-Mail Account', 
            username: 'max.mustermann@example.com', 
            password: 'Password123!', 
            link: 'https://mail.example.com', 
            lastChanged: '14.11.2026',
            subTasks: [{ id: 's1', name: 'Wiederherstellungs-PIN', note: '1234' }]
          },
          { 
            id: '2', 
            title: 'GitHub', 
            username: 'dev-user', 
            password: '123', 
            link: 'https://github.com', 
            lastChanged: '01.01.2023',
            subTasks: []
          }
        ];
        setPasswords(initialDefault);
        await AsyncStorage.setItem('@passwords_key', JSON.stringify(initialDefault));
      }

      if (storedAutoLock) setAutoLockMinutes(storedAutoLock);
      if (storedDarkMode) setIsDarkMode(JSON.parse(storedDarkMode));
    } catch (error) {
      console.error('Fehler beim Laden der Daten:', error);
    }
  };

  const savePasswordsToStorage = async (newPasswords) => {
    try {
      setPasswords(newPasswords);
      await AsyncStorage.setItem('@passwords_key', JSON.stringify(newPasswords));
    } catch (error) {
      console.error('Fehler beim Speichern der Passwörter:', error);
    }
  };

  useEffect(() => {
    AsyncStorage.setItem('@autolock_key', autoLockMinutes);
  }, [autoLockMinutes]);

  useEffect(() => {
    AsyncStorage.setItem('@darkmode_key', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  useEffect(() => {
    const backAction = () => {
      if (isGuideOpen) { setIsGuideOpen(false); return true; }
      if (isSettingsOpen) { setIsSettingsOpen(false); return true; }
      if (isModalOpen) { setIsModalOpen(false); return true; }
      if (isBackupModalOpen) { setIsBackupModalOpen(false); return true; }
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [isGuideOpen, isSettingsOpen, isModalOpen, isBackupModalOpen]);

  const authenticateWithBiometrics = async (promptMessage = 'Identität bestätigen') => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) return true;

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: promptMessage,
        fallbackLabel: 'PIN verwenden',
      });
      return result.success;
    } catch (error) {
      return false;
    }
  };

  useEffect(() => {
    (async () => {
      const success = await authenticateWithBiometrics('Tresor entsperren');
      if (success) setIsLocked(false);
    })();
  }, []);

  const toggleExpand = async (id) => {
    resetInactivityTimer();
    const isCurrentlyExpanded = !!expandedIds[id];

    if (!isCurrentlyExpanded) {
      const success = await authenticateWithBiometrics('Identität bestätigen, um Eintrag aufzuklappen');
      if (!success) {
        Alert.alert('Abgebrochen', 'Biometrische Authentifizierung erforderlich.');
        return;
      }
    }

    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const resetInactivityTimer = () => {
    if (isLocked) return;
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    const mins = parseFloat(autoLockMinutes) || 5;
    inactivityTimerRef.current = setTimeout(() => setIsLocked(true), mins * 60 * 1000);
  };

  useEffect(() => {
    resetInactivityTimer();
    return () => { if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current); };
  }, [isLocked, autoLockMinutes]);

  const handleStartExport = () => {
    resetInactivityTimer();
    setBackupPassword('');
    setBackupActionType('export');
    setIsBackupModalOpen(true);
  };

  const handleStartImport = async () => {
    resetInactivityTimer();
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', '*/*'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPendingImportUri(result.assets[0].uri);
        setBackupPassword('');
        setBackupActionType('import');
        setIsBackupModalOpen(true);
      }
    } catch (error) {
      Alert.alert('Fehler', 'Dateiauswahl fehlgeschlagen: ' + error.message);
    }
  };

  const deriveKey = async (password) => {
    return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);
  };

  const executeEncryptedExport = async () => {
    if (!backupPassword) {
      Alert.alert('Fehler', 'Bitte gib ein Passwort für das Backup ein.');
      return;
    }
    try {
      const rawData = JSON.stringify({ passwords, autoLockMinutes, isDarkMode }, null, 2);
      const keyHash = await deriveKey(backupPassword);
      const payload = JSON.stringify({ keyHash, data: rawData });
      const encodedData = btoa(unescape(encodeURIComponent(payload)));

      const timestamp = new Date().toISOString().replace(/[:/]/g, '-').slice(0, 19);
      const fileName = `secure_backup_${timestamp}.enc`;

      if (Platform.OS === 'android') {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          const uri = await FileSystem.StorageAccessFramework.createFileAsync(permissions.directoryUri, fileName, 'application/json');
          await FileSystem.writeAsStringAsync(uri, encodedData, { encoding: FileSystem.EncodingType.UTF8 });
          setIsBackupModalOpen(false);
          Alert.alert('Erfolg', 'Backup erfolgreich gespeichert.');
        }
      } else {
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(fileUri, encodedData, { encoding: FileSystem.EncodingType.UTF8 });
        setIsBackupModalOpen(false);
        Alert.alert('Erfolg', `Backup erstellt unter:\n${fileUri}`);
      }
    } catch (error) {
      Alert.alert('Fehler', 'Export fehlgeschlagen: ' + error.message);
    }
  };

  const executeEncryptedImport = async () => {
    if (!backupPassword || !pendingImportUri) {
      Alert.alert('Fehler', 'Bitte gib das Passwort ein.');
      return;
    }
    try {
      const fileContent = await FileSystem.readAsStringAsync(pendingImportUri);
      const decodedString = decodeURIComponent(escape(atob(fileContent)));
      const parsedPayload = JSON.parse(decodedString);

      const enteredKeyHash = await deriveKey(backupPassword);
      if (parsedPayload.keyHash !== enteredKeyHash) throw new Error('Falsches Passwort.');

      const parsedData = JSON.parse(parsedPayload.data);
      if (parsedData && Array.isArray(parsedData.passwords)) {
        await savePasswordsToStorage(parsedData.passwords);
        if (parsedData.autoLockMinutes) setAutoLockMinutes(parsedData.autoLockMinutes);
        if (typeof parsedData.isDarkMode === 'boolean') setIsDarkMode(parsedData.isDarkMode);
        setIsBackupModalOpen(false);
        Alert.alert('Erfolg', 'Backup erfolgreich wiederhergestellt!');
      } else {
        Alert.alert('Fehler', 'Ungültiges Datenformat im Backup.');
      }
    } catch (error) {
      Alert.alert('Fehler', 'Wiederherstellung fehlgeschlagen. Ist das Passwort korrekt?');
    }
  };

  const isPasswordWeak = (pwd) => pwd.length < 8;

  const calculatePasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: 'Leer', color: '#CBD5E1' };
    let score = 0;
    if (pwd.length >= 8) score += 30;
    if (pwd.length >= 12) score += 20;
    if (/[A-Z]/.test(pwd)) score += 15;
    if (/[0-9]/.test(pwd)) score += 15;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 20;
    if (score > 100) score = 100;

    let label = 'Schwach';
    let color = '#EF4444';
    if (score >= 40 && score < 70) { label = 'Mittel'; color = '#F59E0B'; }
    else if (score >= 70 && score < 100) { label = 'Stark'; color = '#3B82F6'; }
    else if (score === 100) { label = 'Sehr sicher'; color = '#10B981'; }

    return { score, label, color };
  };

  const isPasswordOlderThanOneYear = (dateStr) => {
    if (!dateStr) return false;
    const parts = dateStr.split('.');
    if (parts.length !== 3) return false;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const lastDate = new Date(year, month, day);
    const diffTime = new Date() - lastDate;
    return diffTime / (1000 * 60 * 60 * 24) > 365;
  };

  const formatDateString = (input) => {
    const cleaned = input.replace(/\D/g, '');
    if (cleaned.length === 8) {
      return `${cleaned.substring(0, 2)}.${cleaned.substring(2, 4)}.${cleaned.substring(4, 8)}`;
    }
    const today = new Date();
    return `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()}`;
  };

  const handleOpenAddModal = () => {
    resetInactivityTimer();
    setEditingId(null);
    setTitle('');
    setUsername('');
    setPassword('');
    setLink('');
    setLastChangedInput('');
    setSubTasks([]);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item) => {
    resetInactivityTimer();
    setEditingId(item.id);
    setTitle(item.title);
    setUsername(item.username);
    setPassword(item.password);
    setLink(item.link || '');
    setLastChangedInput(item.lastChanged ? item.lastChanged.replace(/\./g, '') : '');
    setSubTasks(item.subTasks ? [...item.subTasks] : []);
    setIsModalOpen(true);
  };

  const handleSavePassword = () => {
    resetInactivityTimer();
    if (!title || !password) {
      Alert.alert('Fehler', 'Bitte gib mindestens einen Titel und ein Passwort ein.');
      return;
    }

    const formattedDate = formatDateString(lastChangedInput);
    let updatedList = [...passwords];

    if (editingId) {
      updatedList = updatedList.map(item => 
        item.id === editingId 
          ? { ...item, title, username, password, link, lastChanged: formattedDate, subTasks } 
          : item
      );
    } else {
      const newEntry = {
        id: Date.now().toString(),
        title,
        username,
        password,
        link,
        lastChanged: formattedDate,
        subTasks
      };
      updatedList.push(newEntry);
    }

    updatedList.sort((a, b) => a.title.localeCompare(b.title, 'de', { sensitivity: 'base' }));

    savePasswordsToStorage(updatedList);
    setIsModalOpen(false);
  };

  const handleDeletePassword = async (id) => {
    const success = await authenticateWithBiometrics('Identität bestätigen, um Eintrag zu löschen');
    if (!success) {
      Alert.alert('Abgebrochen', 'Authentifizierung erforderlich.');
      return;
    }
    resetInactivityTimer();
    const updatedList = passwords.filter(item => item.id !== id);
    savePasswordsToStorage(updatedList);
  };

  const generateRandomPassword = () => {
    resetInactivityTimer();
    let chars = 'abcdefghijklmnopqrstuvwxyz';
    if (useUppercase) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (useNumbers) chars += '0123456789';
    if (useSymbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';

    const length = parseInt(genLength, 10) || 14;
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(result);
  };

  const copyToClipboard = (text, label) => {
    resetInactivityTimer();
    Clipboard.setString(text);
    Alert.alert('Kopiert!', `${label} wurde in die Zwischenablage kopiert.`);
  };

  const openLink = (url) => {
    resetInactivityTimer();
    if (!url) return;
    let formattedUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) formattedUrl = 'https://' + url;
    Linking.openURL(formattedUrl).catch(() => Alert.alert('Fehler', 'Der Link konnte nicht geöffnet werden.'));
  };

  const addSubTaskField = () => {
    resetInactivityTimer();
    setSubTasks([...subTasks, { id: Date.now().toString(), name: '', note: '' }]);
  };

  const updateSubTask = (id, field, value) => {
    setSubTasks(subTasks.map(st => st.id === id ? { ...st, [field]: value } : st));
  };

  const removeSubTask = (id) => {
    setSubTasks(subTasks.filter(st => st.id !== id));
  };

  const getDuplicatePasswords = () => {
    const counts = {};
    passwords.forEach(p => { counts[p.password] = (counts[p.password] || 0) + 1; });
    return Object.keys(counts).filter(pwd => counts[pwd] > 1);
  };

  const duplicateList = getDuplicatePasswords();
  const weakCount = passwords.filter(p => isPasswordWeak(p.password)).length;
  const oldPasswordCount = passwords.filter(p => isPasswordOlderThanOneYear(p.lastChanged)).length;

  const filteredPasswords = passwords.filter(item => {
    const matchesSearch = 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.username && item.username.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (activeAuditFilter === 'WEAK') return isPasswordWeak(item.password);
    if (activeAuditFilter === 'DUPLICATES') return duplicateList.includes(item.password);
    if (activeAuditFilter === 'OLD') return isPasswordOlderThanOneYear(item.lastChanged);
    return true;
  });

  const jumpToFilter = (type) => {
    resetInactivityTimer();
    setActiveAuditFilter(type);
    setIsSettingsOpen(false);
  };

  const getFilterBannerText = () => {
    if (activeAuditFilter === 'WEAK') return 'Schwache Passwörter';
    if (activeAuditFilter === 'DUPLICATES') return 'Doppelte Passwörter';
    if (activeAuditFilter === 'OLD') return 'Älter als 1 Jahr';
    return '';
  };

  const strengthInfo = calculatePasswordStrength(password);

  if (isLocked) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <StatusBar barStyle="light-content" />
        <View style={[styles.lockCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <Text style={{ fontSize: 40, textAlign: 'center', marginBottom: 12 }}>🛡️</Text>
          <Text style={[styles.modalTitle, { textAlign: 'center', color: theme.text }]}>Biometrisch geschützt</Text>
          <Text style={[styles.subtextCustom, { color: theme.subtext, textAlign: 'center', marginBottom: 24, lineHeight: 20 }]}>
            Bitte authentifiziere dich per Gesichtserkennung oder Fingerabdruck, um den Tresor zu öffnen.
          </Text>
          <TouchableOpacity
            style={[styles.btnFull, { backgroundColor: theme.primary }]}
            onPress={() => authenticateWithBiometrics('Tresor entsperren').then(succ => succ && setIsLocked(false))}
          >
            <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>Mit Biometrie entsperren</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView 
      style={[styles.container, { backgroundColor: theme.bg }]}
      onTouchStart={resetInactivityTimer}
    >
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.headerBg }]}>
        <View style={styles.headerLeft}>
          <Text style={{ fontSize: 22, marginRight: 8 }}>🔐</Text>
          <Text style={styles.headerTitle}>Password Manager</Text>
        </View>
        <TouchableOpacity onPress={() => { resetInactivityTimer(); setIsSettingsOpen(true); }} style={styles.iconButton}>
          <Text style={{ fontSize: 20 }}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Suchleiste */}
      <View style={[styles.searchFilterContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
        <View style={[styles.searchBarWrapper, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
          <TextInput
            placeholder="🔍 Suchen..."
            placeholderTextColor={theme.subtext}
            style={[styles.searchInput, { color: theme.text }]}
            value={searchQuery}
            onChangeText={(text) => { resetInactivityTimer(); setSearchQuery(text); }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
              <Text style={{ color: theme.subtext, fontSize: 14, fontWeight: 'bold' }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {activeAuditFilter && (
          <View style={styles.filterBanner}>
            <Text style={styles.filterBannerText}>Filter: {getFilterBannerText()}</Text>
            <TouchableOpacity onPress={() => setActiveAuditFilter(null)}>
              <Text style={{ color: theme.primary, fontWeight: 'bold', fontSize: 12 }}>Filter zurücksetzen ✖</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Main List */}
      <FlatList
        data={filteredPasswords}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => {
          const weak = isPasswordWeak(item.password);
          const old = isPasswordOlderThanOneYear(item.lastChanged);
          const isDuplicate = duplicateList.includes(item.password);
          const isExpanded = !!expandedIds[item.id];
          const hasIssues = weak || old || isDuplicate;

          return (
            <TouchableOpacity 
              activeOpacity={0.9} 
              onPress={() => toggleExpand(item.id)}
              style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
            >
              <View style={[styles.cardAccentBar, { backgroundColor: hasIssues ? '#EF4444' : theme.primary }]} />

              <View style={styles.cardInner}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 8 }}>
                    <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>{item.title}</Text>
                    
                    <View style={styles.warningColumn}>
                      <View style={[styles.warningBadge, styles.badgeWeak, { opacity: weak ? 1 : 0 }]}>
                        <Text style={[styles.warningBadgeText, styles.badgeTextWeak]}>Schwach</Text>
                      </View>
                      <View style={[styles.warningBadge, styles.badgeDuplicate, { opacity: isDuplicate ? 1 : 0 }]}>
                        <Text style={[styles.warningBadgeText, styles.badgeTextDuplicate]}>Doppelt</Text>
                      </View>
                      <View style={[styles.warningBadge, styles.badgeOld, { opacity: old ? 1 : 0 }]}>
                        <Text style={[styles.warningBadgeText, styles.badgeTextOld]}>Veraltet</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.cardActionsTop}>
                    <Text style={{ fontSize: 14, color: theme.subtext, marginLeft: 4 }}>{isExpanded ? '▲' : '▼'}</Text>
                  </View>
                </View>

                {isExpanded && (
                  <View style={{ marginTop: 8 }}>
                    {item.username ? (
                      <View style={styles.infoRow}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={[styles.infoLabel, { color: theme.subtext }]}>Benutzername</Text>
                          <Text style={[styles.infoValue, { color: theme.text }]} numberOfLines={1}>{item.username}</Text>
                        </View>
                        <TouchableOpacity style={[styles.miniBtn, { backgroundColor: theme.primaryLight }]} onPress={() => copyToClipboard(item.username, 'Benutzername')}>
                          <Text style={[styles.miniBtnText, { color: theme.primary }]}>Kopieren</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}

                    {item.link ? (
                      <View style={styles.infoRow}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={[styles.infoLabel, { color: theme.subtext }]}>Website</Text>
                          <TouchableOpacity onPress={() => openLink(item.link)}>
                            <Text style={[styles.infoValue, { color: theme.primary, textDecorationLine: 'underline' }]} numberOfLines={1}>
                              {item.link}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        <TouchableOpacity style={[styles.miniBtn, { backgroundColor: theme.primaryLight }]} onPress={() => openLink(item.link)}>
                          <Text style={[styles.miniBtnText, { color: theme.primary }]}>Öffnen</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}

                    {item.lastChanged ? (
                      <View style={styles.infoRow}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={[styles.infoLabel, { color: theme.subtext }]}>Letzte Änderung</Text>
                          <Text style={[styles.infoValue, { color: old ? '#D97706' : theme.text }]} numberOfLines={1}>
                            {item.lastChanged} {old ? '⚠️ (älter als 1 Jahr)' : ''}
                          </Text>
                        </View>
                      </View>
                    ) : null}

                    <View style={styles.infoRow}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={[styles.infoLabel, { color: theme.subtext }]}>Passwort</Text>
                        <Text style={[styles.infoValue, { color: theme.text, fontWeight: 'bold' }]} numberOfLines={1}>
                          {showPasswordId === item.id ? item.password : '••••••••••••'}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <TouchableOpacity 
                          style={[styles.miniBtn, { backgroundColor: theme.primaryLight }]} 
                          onPress={() => setShowPasswordId(showPasswordId === item.id ? null : item.id)}
                        >
                          <Text style={[styles.miniBtnText, { color: theme.primary }]}>
                            {showPasswordId === item.id ? 'Verbergen' : 'Anzeigen'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.miniBtn, { backgroundColor: theme.primaryLight }]} onPress={() => copyToClipboard(item.password, 'Passwort')}>
                          <Text style={[styles.miniBtnText, { color: theme.primary }]}>Kopieren</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {item.subTasks && item.subTasks.length > 0 && (
                      <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 6 }}>
                        <Text style={[styles.infoLabel, { color: theme.primary, marginBottom: 4 }]}>Unteraufgaben / Zusatzinfos:</Text>
                        {item.subTasks.map(st => (
                          <View key={st.id} style={[styles.subTaskDisplayCard, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: theme.text }}>{st.name || 'Unbenannt'}</Text>
                            {st.note ? <Text style={{ fontSize: 12, color: theme.subtext, marginTop: 2 }}>{st.note}</Text> : null}
                          </View>
                        ))}
                      </View>
                    )}

                    <View style={styles.expandedActionsRow}>
                      <TouchableOpacity 
                        onPress={() => handleOpenEditModal(item)} 
                        style={[styles.expandedActionBtn, { backgroundColor: theme.primaryLight }]}
                      >
                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: theme.primary }}>✏️ Bearbeiten</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        onPress={() => handleDeletePassword(item.id)} 
                        style={[styles.expandedActionBtn, { backgroundColor: theme.dangerBg }]}
                      >
                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#EF4444' }}>🗑️ Löschen (mit Biometrie)</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: theme.subtext }]}>Keine passenden Einträge gefunden.</Text>
        }
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={handleOpenAddModal}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Backup Password Modal */}
      <Modal visible={isBackupModalOpen} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {backupActionType === 'export' ? 'Backup verschlüsseln' : 'Backup entschlüsseln'}
            </Text>
            <Text style={[styles.subtextCustom, { color: theme.subtext, marginBottom: 16, fontSize: 13 }]}>
              {backupActionType === 'export' 
                ? 'Gib ein sicheres Passwort ein, um die Backup-Datei zu schützen.' 
                : 'Gib das Passwort ein, mit dem dieses Backup verschlüsselt wurde.'}
            </Text>

            <TextInput
              placeholder="Backup-Passwort"
              placeholderTextColor={theme.subtext}
              secureTextEntry
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.inputBg }]}
              value={backupPassword}
              onChangeText={setBackupPassword}
              autoCapitalize="none"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.btn, { backgroundColor: theme.border }]} onPress={() => setIsBackupModalOpen(false)}>
                <Text style={[styles.btnText, { color: theme.text }]}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: theme.primary }]} onPress={backupActionType === 'export' ? executeEncryptedExport : executeEncryptedImport}>
                <Text style={[styles.btnText, { color: '#FFF' }]}>{backupActionType === 'export' ? 'Exportieren' : 'Wiederherstellen'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add / Edit Password Modal */}
      <Modal visible={isModalOpen} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg, maxHeight: '90%' }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {editingId ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <TextInput
                placeholder="Titel (z. B. Netflix) *"
                placeholderTextColor={theme.subtext}
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.inputBg }]}
                value={title}
                onChangeText={setTitle}
                returnKeyType="next"
                onSubmitEditing={() => usernameRef.current?.focus()}
                blurOnSubmit={false}
              />

              <TextInput
                ref={usernameRef}
                placeholder="Benutzername / E-Mail"
                placeholderTextColor={theme.subtext}
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.inputBg }]}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={() => linkRef.current?.focus()}
                blurOnSubmit={false}
              />

              <TextInput
                ref={linkRef}
                placeholder="Web-Link (z. B. netflix.com)"
                placeholderTextColor={theme.subtext}
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.inputBg }]}
                value={link}
                onChangeText={setLink}
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={() => dateRef.current?.focus()}
                blurOnSubmit={false}
              />

              <TextInput
                ref={dateRef}
                placeholder="Letzte Änderung (TTMMJJJJ)"
                placeholderTextColor={theme.subtext}
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.inputBg }]}
                value={lastChangedInput}
                onChangeText={setLastChangedInput}
                keyboardType="numeric"
                maxLength={8}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                blurOnSubmit={false}
              />

              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <TextInput
                  ref={passwordRef}
                  placeholder="Passwort *"
                  placeholderTextColor={theme.subtext}
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.inputBg, flex: 1, marginBottom: 0 }]}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity style={[styles.btnGen, { backgroundColor: theme.primary }]} onPress={generateRandomPassword}>
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Generieren</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.strengthContainer}>
                <View style={styles.strengthHeaderRow}>
                  <Text style={[styles.strengthLabelTitle, { color: theme.subtext }]}>Sicherheit:</Text>
                  <Text style={[styles.strengthLabelText, { color: strengthInfo.color }]}>
                    {strengthInfo.label} ({strengthInfo.score}%)
                  </Text>
                </View>
                <View style={[styles.strengthBarBg, { backgroundColor: theme.border }]}>
                  <View style={[styles.strengthBarFill, { width: `${strengthInfo.score}%`, backgroundColor: strengthInfo.color }]} />
                </View>
              </View>

              <View style={{ marginTop: 12, marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={[styles.settingText, { color: theme.text, fontWeight: 'bold', fontSize: 14 }]}>Unteraufgaben / Zusatzfelder</Text>
                  <TouchableOpacity style={[styles.miniBtn, { backgroundColor: theme.primaryLight }]} onPress={addSubTaskField}>
                    <Text style={[styles.miniBtnText, { color: theme.primary }]}>+ Hinzufügen</Text>
                  </TouchableOpacity>
                </View>

                {subTasks.map((st) => (
                  <View key={st.id} style={[styles.subTaskContainer, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                    <TextInput
                      placeholder="Name der Unteraufgabe (z.B. PIN)"
                      placeholderTextColor={theme.subtext}
                      style={[styles.subTaskInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.cardBg }]}
                      value={st.name}
                      onChangeText={(val) => updateSubTask(st.id, 'name', val)}
                    />
                    <TextInput
                      placeholder="Notiz / Inhalt"
                      placeholderTextColor={theme.subtext}
                      style={[styles.subTaskInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.cardBg, marginTop: 6 }]}
                      value={st.note}
                      onChangeText={(val) => updateSubTask(st.id, 'note', val)}
                    />
                    <TouchableOpacity onPress={() => removeSubTask(st.id)} style={{ alignSelf: 'flex-end', marginTop: 4 }}>
                      <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: 'bold' }}>Entfernen ✖</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.btn, { backgroundColor: theme.border }]} onPress={() => setIsModalOpen(false)}>
                  <Text style={[styles.btnText, { color: theme.text }]}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, { backgroundColor: theme.primary }]} onPress={handleSavePassword}>
                  <Text style={[styles.btnText, { color: '#FFF' }]}>Speichern</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Settings Modal (Tabs) */}
      <Modal visible={isSettingsOpen} animationType="slide">
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
          <View style={[styles.header, { backgroundColor: theme.headerBg }]}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Einstellungen</Text>
            </View>
            <TouchableOpacity onPress={() => setIsSettingsOpen(false)} style={styles.iconButton}>
              <Text style={{ fontSize: 16, color: '#FFF', fontWeight: 'bold' }}>Fertig</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.tabBar, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <TouchableOpacity style={[styles.tabItem, settingsTab === 'security' && { borderBottomColor: theme.primary, borderBottomWidth: 3 }]} onPress={() => setSettingsTab('security')}>
              <Text style={[styles.tabText, { color: settingsTab === 'security' ? theme.primary : theme.subtext }]}>Sicherheit & Audit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tabItem, settingsTab === 'generator' && { borderBottomColor: theme.primary, borderBottomWidth: 3 }]} onPress={() => setSettingsTab('generator')}>
              <Text style={[styles.tabText, { color: settingsTab === 'generator' ? theme.primary : theme.subtext }]}>Generator</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tabItem, settingsTab === 'general' && { borderBottomColor: theme.primary, borderBottomWidth: 3 }]} onPress={() => setSettingsTab('general')}>
              <Text style={[styles.tabText, { color: settingsTab === 'general' ? theme.primary : theme.subtext }]}>Allgemein</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 16 }}>
            {settingsTab === 'security' && (
              <View>
                <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={[styles.settingText, { color: theme.text }]}>Auto-Lock (Minuten)</Text>
                    <Text style={{ fontSize: 11, color: theme.subtext, marginTop: 2 }}>Sperrt die App nach Inaktivität</Text>
                  </View>
                  <TextInput
                    style={[styles.numberInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.inputBg }]}
                    value={autoLockMinutes}
                    onChangeText={setAutoLockMinutes}
                    keyboardType="numeric"
                    maxLength={3}
                  />
                </View>

                <Text style={[styles.sectionHeader, { color: theme.primary }]}>💾 Verschlüsselte Backups</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 6, marginBottom: 16 }}>
                  <TouchableOpacity style={[styles.backupBtn, { backgroundColor: theme.primary, flex: 1 }]} onPress={handleStartExport}>
                    <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 14 }}>Backup exportieren</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.backupBtn, { backgroundColor: theme.cardBg, borderColor: theme.border, borderWidth: 1, flex: 1 }]} onPress={handleStartImport}>
                    <Text style={{ color: theme.text, fontWeight: 'bold', fontSize: 14 }}>Backup importieren</Text>
                  </TouchableOpacity>
                </View>

                <Text style={[styles.sectionHeader, { color: theme.primary }]}>🛡️ Passwort-Sicherheits-Check</Text>
                <View style={[styles.auditContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                  <View style={styles.auditItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.auditTitle, { color: theme.text }]}>Gesamteinträge</Text>
                      <Text style={[styles.auditSub, { color: theme.subtext }]}>Gespeicherte Tresor-Einträge</Text>
                    </View>
                    <View style={styles.auditRightWrapper}>
                      <View style={[styles.auditBadge, { backgroundColor: theme.inputBg }]}>
                        <Text style={[styles.auditBadgeText, { color: theme.text }]}>{passwords.length}</Text>
                      </View>
                      <View style={styles.arrowPlaceholder} />
                    </View>
                  </View>

                  <TouchableOpacity style={[styles.auditItem, { borderTopWidth: 1, borderTopColor: theme.border }]} onPress={() => jumpToFilter('WEAK')} disabled={weakCount === 0}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.auditTitle, { color: theme.text }]}>Schwache Passwörter</Text>
                      <Text style={[styles.auditSub, { color: theme.subtext }]}>Weniger als 8 Zeichen</Text>
                    </View>
                    <View style={styles.auditRightWrapper}>
                      <View style={[styles.auditBadge, { backgroundColor: weakCount > 0 ? '#FEE2E2' : '#D1FAE5' }]}>
                        <Text style={[styles.auditBadgeText, { color: weakCount > 0 ? '#EF4444' : '#10B981' }]}>{weakCount} {weakCount > 0 ? '⚠️' : '✅'}</Text>
                      </View>
                      {weakCount > 0 ? <Text style={[styles.arrowText, { color: theme.primary }]}>›</Text> : <View style={styles.arrowPlaceholder} />}
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.auditItem, { borderTopWidth: 1, borderTopColor: theme.border }]} onPress={() => jumpToFilter('DUPLICATES')} disabled={duplicateList.length === 0}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.auditTitle, { color: theme.text }]}>Doppelte Passwörter</Text>
                      <Text style={[styles.auditSub, { color: theme.subtext }]}>Mehrfach verwendete Codes</Text>
                    </View>
                    <View style={styles.auditRightWrapper}>
                      <View style={[styles.auditBadge, { backgroundColor: duplicateList.length > 0 ? '#FFEDD5' : '#D1FAE5' }]}>
                        <Text style={[styles.auditBadgeText, { color: duplicateList.length > 0 ? '#F97316' : '#10B981' }]}>{duplicateList.length} {duplicateList.length > 0 ? '⚠️' : '✅'}</Text>
                      </View>
                      {duplicateList.length > 0 ? <Text style={[styles.arrowText, { color: theme.primary }]}>›</Text> : <View style={styles.arrowPlaceholder} />}
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.auditItem, { borderTopWidth: 1, borderTopColor: theme.border }]} onPress={() => jumpToFilter('OLD')} disabled={oldPasswordCount === 0}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.auditTitle, { color: theme.text }]}>Älter als 1 Jahr</Text>
                      <Text style={[styles.auditSub, { color: theme.subtext }]}>Lange nicht geändert</Text>
                    </View>
                    <View style={styles.auditRightWrapper}>
                      <View style={[styles.auditBadge, { backgroundColor: oldPasswordCount > 0 ? '#FEF3C7' : '#D1FAE5' }]}>
                        <Text style={[styles.auditBadgeText, { color: oldPasswordCount > 0 ? '#D97706' : '#10B981' }]}>{oldPasswordCount} {oldPasswordCount > 0 ? '⚠️' : '✅'}</Text>
                      </View>
                      {oldPasswordCount > 0 ? <Text style={[styles.arrowText, { color: theme.primary }]}>›</Text> : <View style={styles.arrowPlaceholder} />}
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {settingsTab === 'generator' && (
              <View>
                <Text style={[styles.sectionHeader, { color: theme.primary, marginTop: 0 }]}>🔑 Passwort-Generator Optionen</Text>
                <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.settingText, { color: theme.text }]}>Zeichenlänge</Text>
                  <TextInput
                    style={[styles.numberInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.inputBg }]}
                    value={genLength}
                    onChangeText={setGenLength}
                    keyboardType="numeric"
                    maxLength={2}
                  />
                </View>
                <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.settingText, { color: theme.text }]}>Sonderzeichen einschließen (!@#...)</Text>
                  <Switch value={useSymbols} onValueChange={setUseSymbols} trackColor={{ false: '#cbd5e1', true: '#3b82f6' }} />
                </View>
                <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.settingText, { color: theme.text }]}>Zahlen einschließen (0-9)</Text>
                  <Switch value={useNumbers} onValueChange={setUseNumbers} trackColor={{ false: '#cbd5e1', true: '#3b82f6' }} />
                </View>
                <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.settingText, { color: theme.text }]}>Großbuchstaben (A-Z)</Text>
                  <Switch value={useUppercase} onValueChange={setUseUppercase} trackColor={{ false: '#cbd5e1', true: '#3b82f6' }} />
                </View>
              </View>
            )}

            {settingsTab === 'general' && (
              <View>
                <View style={[styles.settingRow, { borderBottomColor: theme.border, marginTop: 0 }]}>
                  <Text style={[styles.settingText, { color: theme.text }]}>Dunkelmodus</Text>
                  <Switch value={isDarkMode} onValueChange={setIsDarkMode} trackColor={{ false: '#cbd5e1', true: '#3b82f6' }} />
                </View>

                <TouchableOpacity style={[styles.settingRow, { borderBottomColor: theme.border }]} onPress={() => setIsGuideOpen(true)}>
                  <Text style={[styles.settingText, { color: theme.text }]}>📖 Benutzerhandbuch</Text>
                  <Text style={{ color: theme.subtext }}>›</Text>
                </TouchableOpacity>

                <View style={[styles.devSection, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                  <Text style={[styles.devTitle, { color: theme.text }]}>Entwicklerinformationen</Text>
                  <Text style={[styles.devText, { color: theme.subtext }]}>Entwickler: Özgür Cetin</Text>
                  <Text style={[styles.devText, { color: theme.subtext }]}>E-Mail: ozgur.cetin@web.de</Text>
                  <Text style={[styles.devText, { color: theme.subtext }]}>Version: 3.9.1 (Handbuch aktualisiert)</Text>
                </View>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Handbuch Modal (Aktualisiert) */}
      <Modal visible={isGuideOpen} animationType="fade">
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
          <View style={[styles.header, { backgroundColor: theme.headerBg }]}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Benutzerhandbuch</Text>
            </View>
            <TouchableOpacity onPress={() => setIsGuideOpen(false)} style={styles.iconButton}>
              <Text style={{ fontSize: 16, color: '#FFF', fontWeight: 'bold' }}>Schließen</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 16 }}>
            <Text style={[styles.guideHeading, { color: theme.primary }]}>1. Dauerhafte Datenspeicherung</Text>
            <Text style={[styles.guideText, { color: theme.subtext }]}>
              Alle hinzugefügten, bearbeiteten oder gelöschten Passwörter und Einstellungen werden automatisch auf deinem Gerät (mittels AsyncStorage) gespeichert und bleiben auch nach dem Schließen der App erhalten.
            </Text>

            <Text style={[styles.guideHeading, { color: theme.primary }]}>2. Aufklappen, Bearbeiten & Löschen</Text>
            <Text style={[styles.guideText, { color: theme.subtext }]}>
              Um Details einzusehen, musst du einen Eintrag antippen und dich biometrisch legitimieren. Erst im aufgeklappten Zustand erscheinen die Buttons zum **Bearbeiten** und **Löschen**. Das Bearbeiten öffnet sich direkt, während das Löschen zur Sicherheit eine erneute biometrische Bestätigung erfordert.
            </Text>

            <Text style={[styles.guideHeading, { color: theme.primary }]}>3. Automatische Sortierung & Navigation</Text>
            <Text style={[styles.guideText, { color: theme.subtext }]}>
              Deine Einträge im Tresor sortieren sich stets vollautomatisch alphabetisch aufsteigend. In den Eingabefeldern kannst du bequem per Enter/Weiter-Taste von Feld zu Feld springen.
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const lightTheme = {
  bg: '#F1F5F9', headerBg: '#2563EB', cardBg: '#FFFFFF', inputBg: '#F8FAFC',
  text: '#1E293B', subtext: '#64748B', border: '#E2E8F0', primary: '#2563EB',
  primaryLight: '#DBEAFE', actionBg: '#F1F5F9', dangerBg: '#FEE2E2'
};

const darkTheme = {
  bg: '#090D16', headerBg: '#1E293B', cardBg: '#111827', inputBg: '#1F2937',
  text: '#F3F4F6', subtext: '#9CA3AF', border: '#1F2937', primary: '#3B82F6',
  primaryLight: '#1E3A8A', actionBg: '#1F2937', dangerBg: '#450A0A'
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  lockCard: {
    width: '88%', maxWidth: 380, borderRadius: 20, borderWidth: 1, padding: 24, elevation: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 16,
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF', letterSpacing: 0.5 },
  iconButton: { padding: 6 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, elevation: 2 },
  tabItem: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabText: { fontSize: 13, fontWeight: 'bold' },
  searchFilterContainer: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  searchBarWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14 },
  clearSearchBtn: { padding: 6 },
  filterBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingHorizontal: 4 },
  filterBannerText: { fontSize: 12, fontWeight: 'bold', color: '#EF4444' },
  card: {
    borderRadius: 14, borderWidth: 1, marginBottom: 14, overflow: 'hidden', flexDirection: 'row',
    elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4
  },
  cardAccentBar: { width: 6 },
  cardInner: { flex: 1, padding: 14 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: 'bold', flex: 1 },
  warningColumn: { flexDirection: 'column', alignItems: 'flex-end', gap: 4, marginLeft: 8 },
  warningBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, minWidth: 72, alignItems: 'center' },
  warningBadgeText: { fontSize: 10, fontWeight: 'bold', textAlign: 'center' },
  badgeWeak: { backgroundColor: '#FEE2E2' },
  badgeTextWeak: { color: '#EF4444' },
  badgeDuplicate: { backgroundColor: '#FFEDD5' },
  badgeTextDuplicate: { color: '#F97316' },
  badgeOld: { backgroundColor: '#FEF3C7' },
  badgeTextOld: { color: '#D97706' },
  cardActionsTop: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.03)', marginTop: 6
  },
  infoLabel: { fontSize: 10, textTransform: 'uppercase', fontWeight: '700', letterSpacing: 0.5, marginBottom: 2 },
  infoValue: { fontSize: 13 },
  miniBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  miniBtnText: { fontSize: 11, fontWeight: '700' },
  emptyText: { textAlign: 'center', marginTop: 40, fontSize: 14 },
  fab: {
    position: 'absolute', right: 20, bottom: 20, width: 58, height: 58, borderRadius: 29,
    justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 6
  },
  fabText: { color: '#FFF', fontSize: 30, lineHeight: 32 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalContent: {
    borderRadius: 18, padding: 20, shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 8
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 14 },
  numberInput: { borderWidth: 1, borderRadius: 8, padding: 6, width: 60, textAlign: 'center', fontSize: 14 },
  btnGen: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  btnFull: { paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  backupBtn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  strengthContainer: { marginBottom: 16 },
  strengthHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  strengthLabelTitle: { fontSize: 12, fontWeight: '600' },
  strengthLabelText: { fontSize: 12, fontWeight: 'bold' },
  strengthBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  strengthBarFill: { height: '100%', borderRadius: 3 },
  subTaskContainer: { borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 8 },
  subTaskInput: { borderWidth: 1, borderRadius: 8, padding: 8, fontSize: 13 },
  subTaskDisplayCard: { borderWidth: 1, borderRadius: 8, padding: 8, marginBottom: 4 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  btn: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10 },
  btnText: { fontWeight: 'bold', fontSize: 14 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
  settingText: { fontSize: 15 },
  sectionHeader: { fontSize: 15, fontWeight: 'bold', marginTop: 22, marginBottom: 6 },
  auditContainer: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginTop: 4 },
  auditItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  auditTitle: { fontSize: 14, fontWeight: '600' },
  auditSub: { fontSize: 12, marginTop: 2 },
  auditRightWrapper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  auditBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, minWidth: 65, alignItems: 'center' },
  auditBadgeText: { fontSize: 13, fontWeight: 'bold' },
  arrowText: { fontSize: 13, fontWeight: 'bold', width: 12, textAlign: 'center' },
  arrowPlaceholder: { width: 12 },
  devSection: { marginTop: 28, padding: 16, borderRadius: 12, borderWidth: 1 },
  devTitle: { fontSize: 15, fontWeight: 'bold', marginBottom: 6 },
  devText: { fontSize: 13, marginBottom: 3 },
  guideHeading: { fontSize: 15, fontWeight: 'bold', marginTop: 16, marginBottom: 4 },
  guideText: { fontSize: 14, lineHeight: 20 },
  expandedActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: 10
  },
  expandedActionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  }
});

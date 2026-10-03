import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@passwords_key_v1';
const MASTER_KEY = '@master_password_v1';
const THEME_KEY = '@theme_mode_v1';

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

  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    await loadTheme();
    await checkMasterPassword();
  };

  // --- THEME SPEICHERUNG ---
  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_KEY);
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
      await AsyncStorage.setItem(THEME_KEY, nextMode ? 'dark' : 'light');
    } catch (e) {
      console.log('Fehler beim Speichern des Themes');
    }
  };

  // --- MASTER-PASSWORT LOGIK ---
  const checkMasterPassword = async () => {
    try {
      const master = await AsyncStorage.getItem(MASTER_KEY);
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
      await AsyncStorage.setItem(MASTER_KEY, newMasterInput.trim());
      setSavedMasterPw(newMasterInput.trim());
      setIsAuthenticated(true);
      setNewMasterInput('');
      setConfirmMasterInput('');
      loadPasswords();
      Alert.alert('Erfolg', 'Master-Passwort erfolgreich eingerichtet!');
    } catch (e) {
      Alert.alert('Fehler', 'Master-Passwort konnte nicht gespeichert werden.');
    }
  };

  const handleLogin = () => {
    if (masterInput === savedMasterPw) {
      setIsAuthenticated(true);
      setMasterInput('');
      loadPasswords();
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
      await AsyncStorage.setItem(MASTER_KEY, newMasterInput.trim());
      setSavedMasterPw(newMasterInput.trim());
      setNewMasterInput('');
      setConfirmMasterInput('');
      setShowMasterSettings(false);
      Alert.alert('Erfolg', 'Master-Passwort wurde geändert.');
    } catch (e) {
      Alert.alert('Fehler', 'Änderung konnte nicht gespeichert werden.');
    }
  };

  // --- PASSWORT SPEICHERUNG & LADEN ---
  const loadPasswords = async () => {
    try {
      const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
      if (jsonValue != null) {
        setPasswords(JSON.parse(jsonValue));
      }
    } catch (e) {
      Alert.alert('Fehler', 'Passwörter konnten nicht geladen werden.');
    }
  };

  const savePasswordsToStorage = async (newPasswords) => {
    try {
      const jsonValue = JSON.stringify(newPasswords);
      await AsyncStorage.setItem(STORAGE_KEY, jsonValue);
    } catch (e) {
      Alert.alert('Fehler', 'Passwort konnte nicht gespeichert werden.');
    }
  };

  // --- BACKUP-FUNKTIONEN (EXPORT & IMPORT) ---
  const handleExportBackup = async () => {
    try {
      const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
      if (!jsonValue || JSON.parse(jsonValue).length === 0) {
        Alert.alert('Hinweis', 'Es sind keine Passwörter zum Sichern vorhanden.');
        return;
      }
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

      // Überprüfen, ob Datenstrukturen übereinstimmen
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
          {
            text: 'Abbrechen',
            style: 'cancel',
          },
          {
            text: 'Zusammenführen',
            onPress: async () => {
              // Bestehende und importierte Daten zusammenführen (Doppelte IDs vermeiden)
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
    setModalVisible(true);
  };

  const openEditModal = (item) => {
    setEditingId(item.id);
    setTitle(item.title);
    setUsername(item.username || '');
    setPassword(item.password);
    setModalVisible(true);
  };

  const handleAddOrUpdatePassword = () => {
    if (!title.trim() || !password.trim()) {
      Alert.alert('Hinweis', 'Bitte mindestens Titel und Passwort eingeben.');
      return;
    }

    let updatedPasswords;

    if (editingId) {
      updatedPasswords = passwords.map((item) => {
        if (item.id === editingId) {
          return {
            ...item,
            title: title.trim(),
            username: username.trim(),
            password: password.trim(),
          };
        }
        return item;
      });
    } else {
      const newEntry = {
        id: Date.now().toString(),
        title: title.trim(),
        username: username.trim(),
        password: password.trim(),
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

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    let result = '';
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(result);
  };

  // --- KOPIER-FUNKTIONEN ---
  const copyToClipboard = (text, typeLabel) => {
    Clipboard.setString(text);
    Alert.alert('Kopiert', `${typeLabel} wurde in die Zwischenablage kopiert.`);
  };

  // --- FARBSCHEMA DYNAMISCH (LIGHT / DARK) ---
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
      };

  // --- MASTER-PASSWORT LOGIN / ERSTELLUNG SCREEN ---
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

        {/* ENTWICKLER INFO MODAL (Login Screen) */}
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

  // --- MAIN APP SCREEN ---
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={colors.card}
      />

      {/* HEADER */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Passwort-Manager</Text>
          <TouchableOpacity onPress={() => setShowDevInfo(true)}>
            <Text style={[styles.headerSubTitle, { color: colors.primary }]}>ⓘ Info</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.headerRight}>
          {/* Dark Mode Switch */}
          <View style={styles.themeToggleContainer}>
            <Text style={{ fontSize: 12, color: colors.subtext, marginRight: 4 }}>
              {isDarkMode ? '🌙' : '☀️'}
            </Text>
            <Switch
              value={isDarkMode}
              onValueChange={toggleTheme}
              trackColor={{ false: '#D1D5DB', true: '#3B82F6' }}
              thumbColor={isDarkMode ? '#60A5FA' : '#F3F4F6'}
            />
          </View>

          {/* Backup Button */}
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: colors.inputBg }]}
            onPress={() => setShowBackupModal(true)}
          >
            <Text style={{ fontSize: 16 }}>💾</Text>
          </TouchableOpacity>

          {/* Key Settings Button */}
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: colors.inputBg }]}
            onPress={() => setShowMasterSettings(true)}
          >
            <Text style={{ fontSize: 16 }}>🔑</Text>
          </TouchableOpacity>

          {/* Add Button */}
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            onPress={openAddModal}
          >
            <Text style={styles.addButtonText}>+ Neu</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* CONTENT LIST */}
      {passwords.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.text }]}>Keine Passwörter gespeichert.</Text>
          <Text style={[styles.emptySubtext, { color: colors.subtext }]}>
            Tippe auf "+ Neu", um einen Eintrag zu erstellen.
          </Text>
        </View>
      ) : (
        <FlatList
          data={passwords}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isVisible = showPasswordId === item.id;
            return (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {/* Header: Titel und Aktionen (Bearbeiten/Löschen) als kompakte Icon-Buttons */}
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      onPress={() => openEditModal(item)}
                      style={[styles.iconActionButton, { backgroundColor: colors.inputBg }]}
                      accessibilityLabel="Bearbeiten"
                    >
                      <Text style={{ fontSize: 14 }}>✏️️</Text>
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

                {/* Benutzername-Zeile mit Icon-Kopierbutton */}
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

                {/* Passwort-Zeile mit Icon-Buttons für Kopieren und Anzeigen/Verbergen */}
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

      {/* FOOTER MIT ENTWICKLER-HINWEIS */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Text style={[styles.footerText, { color: colors.subtext }]}>
          Entwickelt von <Text style={{ fontWeight: 'bold', color: colors.text }}>Özgür Cetin</Text> | ozgur.cetin@web.de
        </Text>
      </View>

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

      {/* MODAL: BACKUP (EXPORT / IMPORT) */}
      <Modal visible={showBackupModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Backup & Wiederherstellung
            </Text>

            {/* Export Bereich */}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'column',
  },
  headerTitle: {
    fontSize: 20,
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
  },
  themeToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  iconButton: {
    padding: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  addButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
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
    flex: 1,
    marginRight: 8,
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
    justifyContent: 'space-between',
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
});

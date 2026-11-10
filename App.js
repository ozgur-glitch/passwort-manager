import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  StatusBar,
  Switch,
  Modal,
  ScrollView,
  Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';

const STORAGE_KEY_ITEMS = '@password_manager_items';
const STORAGE_KEY_THEME = '@password_manager_theme';
const STORAGE_KEY_MASTER = '@password_manager_master_pin';

export default function App() {
  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasMasterPin, setHasMasterPin] = useState(false);
  const [inputMasterPin, setInputMasterPin] = useState('');
  const [storedMasterPin, setStoredMasterPin] = useState('');

  // App Data State
  const [passwords, setPasswords] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
  const [isGuideModalVisible, setIsGuideModalVisible] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [notes, setNotes] = useState('');
  const [showPasswordMap, setShowPasswordMap] = useState({});

  // Generator Options
  const [genLength, setGenLength] = useState(16);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      // Darkmode laden
      const savedTheme = await AsyncStorage.getItem(STORAGE_KEY_THEME);
      if (savedTheme !== null) {
        setIsDarkMode(savedTheme === 'dark');
      }

      // Master PIN laden
      const savedPin = await AsyncStorage.getItem(STORAGE_KEY_MASTER);
      if (savedPin) {
        setStoredMasterPin(savedPin);
        setHasMasterPin(true);
      } else {
        setHasMasterPin(false);
      }

      // Passwörter laden
      const savedData = await AsyncStorage.getItem(STORAGE_KEY_ITEMS);
      if (savedData !== null) {
        setPasswords(JSON.parse(savedData));
      }
    } catch (e) {
      console.error('Fehler beim Laden der Daten:', e);
    }
  };

  const savePasswordsToStorage = async (data) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(data));
    } catch (e) {
      console.error('Fehler beim Speichern:', e);
    }
  };

  const toggleTheme = async (value) => {
    setIsDarkMode(value);
    await AsyncStorage.setItem(STORAGE_KEY_THEME, value ? 'dark' : 'light');
  };

  // Auth Handler
  const handleAuthSubmit = async () => {
    if (!hasMasterPin) {
      if (inputMasterPin.length < 4) {
        Alert.alert('Hinweis', 'Die Master-PIN muss mindestens 4-stellig sein.');
        return;
      }
      await AsyncStorage.setItem(STORAGE_KEY_MASTER, inputMasterPin);
      setStoredMasterPin(inputMasterPin);
      setHasMasterPin(true);
      setIsAuthenticated(true);
      setInputMasterPin('');
    } else {
      if (inputMasterPin === storedMasterPin) {
        setIsAuthenticated(true);
        setInputMasterPin('');
      } else {
        Alert.alert('Fehler', 'Falsche Master-PIN!');
      }
    }
  };

  // Passwort-Generator
  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let result = '';
    for (let i = 0; i < genLength; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(result);
  };

  // Passwort hinzufügen
  const handleAddPassword = () => {
    if (!title || !password) {
      Alert.alert('Fehler', 'Bitte gib mindestens einen Titel und ein Passwort ein.');
      return;
    }

    const newItem = {
      id: Date.now().toString(),
      title,
      username,
      password,
      notes,
      createdAt: new Date().toLocaleDateString('de-DE'),
    };

    const updated = [newItem, ...passwords];
    setPasswords(updated);
    savePasswordsToStorage(updated);

    // Formular zurücksetzen
    setTitle('');
    setUsername('');
    setPassword('');
    setNotes('');
    setIsAddModalVisible(false);
  };

  // Passwort löschen
  const handleDelete = (id) => {
    Alert.alert('Löschen', 'Möchtest du diesen Eintrag wirklich löschen?', [
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
    ]);
  };

  // Zwischenablage
  const copyToClipboard = async (text, label) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Kopiert', `${label} wurde in die Zwischenablage kopiert.`);
  };

  // Anzeigestatus für Passwort umschalten
  const toggleShowPassword = (id) => {
    setShowPasswordMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Filterung
  const filteredPasswords = passwords.filter(
    (item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Dynamic Theme Colors
  const theme = {
    bg: isDarkMode ? '#0F172A' : '#F8FAFC',
    card: isDarkMode ? '#1E293B' : '#FFFFFF',
    text: isDarkMode ? '#F8FAFC' : '#0F172A',
    subText: isDarkMode ? '#94A3B8' : '#64748B',
    border: isDarkMode ? '#334155' : '#E2E8F0',
    primary: '#3B82F6',
    danger: '#EF4444',
    success: '#10B981',
  };

  // Login Screen
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <View style={styles.authContainer}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={[styles.title, { color: theme.text }]}>
            {hasMasterPin ? 'Passwort Manager' : 'Master-PIN erstellen'}
          </Text>
          <Text style={[styles.subtitle, { color: theme.subText }]}>
            {hasMasterPin
              ? 'Gib deine PIN ein, um auf deine Daten zuzugreifen.'
              : 'Erstelle eine PIN zur Sicherung deiner Passwörter.'}
          </Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: theme.card, color: theme.text, borderColor: theme.border },
            ]}
            placeholder="Master-PIN"
            placeholderTextColor={theme.subText}
            secureTextEntry
            keyboardType="numeric"
            value={inputMasterPin}
            onChangeText={setInputMasterPin}
          />
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.primary }]}
            onPress={handleAuthSubmit}
          >
            <Text style={styles.buttonText}>
              {hasMasterPin ? 'Entsperren' : 'PIN Speichern & Starten'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>🔐 SafeKeeper</Text>
        <TouchableOpacity onPress={() => setIsSettingsModalVisible(true)} style={styles.iconBtn}>
          <Text style={{ fontSize: 22 }}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Suchleiste */}
      <View style={styles.searchContainer}>
        <TextInput
          style={[
            styles.searchInput,
            { backgroundColor: theme.card, color: theme.text, borderColor: theme.border },
          ]}
          placeholder="Suchen nach Titel oder Benutzername..."
          placeholderTextColor={theme.subText}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Liste */}
      <FlatList
        data={filteredPasswords}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }}
        ListEmptyComponent={
          <View style={styles.emptyView}>
            <Text style={[styles.emptyText, { color: theme.subText }]}>
              {searchQuery ? 'Keine Passwörter gefunden.' : 'Noch keine Passwörter gespeichert.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isVisible = !!showPasswordMap[item.id];
          return (
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>{item.title}</Text>
                <TouchableOpacity onPress={() => handleDelete(item.id)}>
                  <Text style={{ fontSize: 18 }}>🗑️</Text>
                </TouchableOpacity>
              </View>

              {item.username ? (
                <TouchableOpacity
                  style={styles.fieldRow}
                  onPress={() => copyToClipboard(item.username, 'Benutzername')}
                >
                  <Text style={[styles.fieldLabel, { color: theme.subText }]}>Benutzer:</Text>
                  <Text style={[styles.fieldValue, { color: theme.text }]}>{item.username}</Text>
                  <Text style={styles.copyBadge}>📋 Kopieren</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={styles.fieldRow}
                onPress={() => copyToClipboard(item.password, 'Passwort')}
              >
                <Text style={[styles.fieldLabel, { color: theme.subText }]}>Passwort:</Text>
                <Text style={[styles.fieldValue, { color: theme.text, fontFamily: 'monospace' }]}>
                  {isVisible ? item.password : '••••••••••••'}
                </Text>
                <TouchableOpacity onPress={() => toggleShowPassword(item.id)} style={{ paddingHorizontal: 6 }}>
                  <Text>{isVisible ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
                <Text style={styles.copyBadge}>📋 Kopieren</Text>
              </TouchableOpacity>

              {item.notes ? (
                <Text style={[styles.notes, { color: theme.subText }]}>Notiz: {item.notes}</Text>
              ) : null}
            </View>
          );
        }}
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={() => setIsAddModalVisible(true)}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* MODAL: Passwort hinzufügen */}
      <Modal visible={isAddModalVisible} animationType="slide" transparent={false}>
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Neuer Eintrag</Text>

            <Text style={[styles.label, { color: theme.text }]}>Titel / Dienst *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
              placeholder="z.B. Google, Netflix"
              placeholderTextColor={theme.subText}
              value={title}
              onChangeText={setTitle}
            />

            <Text style={[styles.label, { color: theme.text }]}>Benutzername / E-Mail</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
              placeholder="max@mustermann.de"
              placeholderTextColor={theme.subText}
              value={username}
              onChangeText={setUsername}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.label, { color: theme.text }]}>Passwort *</Text>
              <TouchableOpacity onPress={generatePassword}>
                <Text style={{ color: theme.primary, fontWeight: 'bold' }}>⚡ Zufallspasswort</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
              placeholder="Sicheres Passwort"
              placeholderTextColor={theme.subText}
              value={password}
              onChangeText={setPassword}
            />

            <Text style={[styles.label, { color: theme.text }]}>Notizen (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
              placeholder="Zusätzliche Infos..."
              placeholderTextColor={theme.subText}
              multiline
              numberOfLines={3}
              value={notes}
              onChangeText={setNotes}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.button, styles.btnHalf, { backgroundColor: theme.danger }]}
                onPress={() => setIsAddModalVisible(false)}
              >
                <Text style={styles.buttonText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.btnHalf, { backgroundColor: theme.primary }]}
                onPress={handleAddPassword}
              >
                <Text style={styles.buttonText}>Speichern</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* MODAL: Einstellungen */}
      <Modal visible={isSettingsModalVisible} animationType="slide" transparent={false}>
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Einstellungen ⚙️</Text>

            {/* Dark Mode Switch */}
            <View style={[styles.settingRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.settingText, { color: theme.text }]}>Dunkelmodus (Dark Mode)</Text>
              <Switch value={isDarkMode} onValueChange={toggleTheme} />
            </View>

            {/* Handbuch Link */}
            <TouchableOpacity
              style={[styles.settingRow, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => setIsGuideModalVisible(true)}
            >
              <Text style={[styles.settingText, { color: theme.text }]}>📖 Benutzerhandbuch lesen</Text>
              <Text style={{ color: theme.subText }}>➔</Text>
            </TouchableOpacity>

            {/* Sperren */}
            <TouchableOpacity
              style={[styles.settingRow, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => setIsAuthenticated(false)}
            >
              <Text style={[styles.settingText, { color: theme.danger }]}>🔒 App jetzt sperren</Text>
            </TouchableOpacity>

            {/* Entwickler-Informationen */}
            <View style={[styles.infoBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.infoTitle, { color: theme.text }]}>Entwickler-Informationen</Text>
              <Text style={[styles.infoText, { color: theme.subText }]}>Entwickler: Özgür Cetin</Text>
              <Text style={[styles.infoText, { color: theme.subText }]}>E-Mail: ozgur.cetin@web.de</Text>
              <Text style={[styles.infoText, { color: theme.subText }]}>Version: 1.0.0 (Expo SDK 51)</Text>
            </View>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.primary, marginTop: 20 }]}
              onPress={() => setIsSettingsModalVisible(false)}
            >
              <Text style={styles.buttonText}>Schließen</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* MODAL: Benutzerhandbuch */}
      <Modal visible={isGuideModalVisible} animationType="fade" transparent={false}>
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>📖 Benutzerhandbuch</Text>

            <Text style={[styles.guideSectionHeader, { color: theme.primary }]}>1. Master-PIN</Text>
            <Text style={[styles.guideText, { color: theme.text }]}>
              Beim ersten Start legen Sie eine Master-PIN fest. Diese schützt all Ihre hinterlegten Zugangsdaten lokal auf diesem Gerät.
            </Text>

            <Text style={[styles.guideSectionHeader, { color: theme.primary }]}>2. Passwörter verwalten</Text>
            <Text style={[styles.guideText, { color: theme.text }]}>
              Klicken Sie auf den blauen "+"-Button unten rechts, um neue Zugangsdaten hinzuzufügen. Über das Augensymbol (👁️) können Sie Passwörter anzeigen lassen.
            </Text>

            <Text style={[styles.guideSectionHeader, { color: theme.primary }]}>3. Passwörter generieren</Text>
            <Text style={[styles.guideText, { color: theme.text }]}>
              Im Formular für neue Einträge können Sie über "⚡ Zufallspasswort" automatisch ein hochsicheres Passwort generieren lassen.
            </Text>

            <Text style={[styles.guideSectionHeader, { color: theme.primary }]}>4. Zwischenablage & Löschen</Text>
            <Text style={[styles.guideText, { color: theme.text }]}>
              Tippen Sie auf ein Feld, um Werte direkt in die Zwischenablage zu kopieren. Mit dem Mülleimer-Symbol können Sie Einträge unwiderruflich löschen.
            </Text>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.primary, marginTop: 30 }]}
              onPress={() => setIsGuideModalVisible(false)}
            >
              <Text style={styles.buttonText}>Zurück zu den Einstellungen</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  lockIcon: {
    fontSize: 60,
    textAlign: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  iconBtn: {
    padding: 4,
  },
  searchContainer: {
    padding: 16,
  },
  searchInput: {
    height: 46,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  fieldLabel: {
    width: 80,
    fontSize: 13,
  },
  fieldValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  copyBadge: {
    fontSize: 11,
    color: '#3B82F6',
    marginLeft: 6,
  },
  notes: {
    marginTop: 8,
    fontSize: 12,
    fontStyle: 'italic',
  },
  emptyView: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 25,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 28,
    marginTop: -2,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 14,
    fontSize: 15,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  button: {
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnHalf: {
    width: '48%',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  settingText: {
    fontSize: 15,
    fontWeight: '500',
  },
  infoBox: {
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    marginBottom: 4,
  },
  guideSectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 14,
    marginBottom: 6,
  },
  guideText: {
    fontSize: 14,
    lineHeight: 20,
  },
});

import React, { useState } from 'react';
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
  Alert
} from 'react-native';

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [passwords, setPasswords] = useState([
    { id: '1', title: 'E-Mail Account', username: 'max.mustermann@example.com', password: 'Password123!', category: 'Privat' },
    { id: '2', title: 'GitHub', username: 'dev-user', password: 'SecureGitPass99!', category: 'Arbeit' }
  ]);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [showPasswordId, setShowPasswordId] = useState(null);

  // Form States
  const [title, setTitle] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [category, setCategory] = useState('Privat');

  const theme = isDarkMode ? darkTheme : lightTheme;

  const handleAddPassword = () => {
    if (!title || !password) {
      Alert.alert('Fehler', 'Bitte gib mindestens einen Titel und ein Passwort ein.');
      return;
    }
    const newEntry = {
      id: Date.now().toString(),
      title,
      username,
      password,
      category: category || 'General'
    };
    setPasswords([newEntry, ...passwords]);
    setTitle('');
    setUsername('');
    setPassword('');
    setCategory('Privat');
    setIsAddModalOpen(false);
  };

  const handleDeletePassword = (id) => {
    setPasswords(passwords.filter(item => item.id !== id));
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    let result = '';
    for (let i = 0; i < 14; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(result);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>🔐 KeyVault</Text>
        <TouchableOpacity onPress={() => setIsSettingsOpen(true)} style={styles.iconButton}>
          <Text style={{ fontSize: 24 }}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Main List */}
      <FlatList
        data={passwords}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={[styles.cardTitle, { color: theme.text }]}>{item.title}</Text>
                <Text style={[styles.cardTag, { backgroundColor: theme.tagBg, color: theme.primary }]}>
                  {item.category}
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleDeletePassword(item.id)}>
                <Text style={{ fontSize: 18 }}>🗑️</Text>
              </TouchableOpacity>
            </View>

            {item.username ? (
              <Text style={[styles.cardText, { color: theme.subtext }]}>
                Benutzer: {item.username}
              </Text>
            ) : null}

            <View style={styles.passwordRow}>
              <Text style={[styles.cardText, { color: theme.text, fontWeight: 'bold' }]}>
                Passwort: {showPasswordId === item.id ? item.password : '••••••••••••'}
              </Text>
              <TouchableOpacity onPress={() => setShowPasswordId(showPasswordId === item.id ? null : item.id)}>
                <Text style={{ color: theme.primary, fontSize: 14 }}>
                  {showPasswordId === item.id ? ' Verbergen' : ' Anzeigen'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: theme.subtext }]}>
            Keine Passwörter gespeichert. Tippe auf "+", um eines hinzuzufügen.
          </Text>
        }
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={() => setIsAddModalOpen(true)}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Add Password Modal */}
      <Modal visible={isAddModalOpen} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Neuer Eintrag</Text>

            <TextInput
              placeholder="Titel (z. B. Netflix)"
              placeholderTextColor={theme.subtext}
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              value={title}
              onChangeText={setTitle}
            />

            <TextInput
              placeholder="Benutzername / E-Mail"
              placeholderTextColor={theme.subtext}
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              value={username}
              onChangeText={setUsername}
            />

            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TextInput
                placeholder="Passwort"
                placeholderTextColor={theme.subtext}
                style={[styles.input, { color: theme.text, borderColor: theme.border, flex: 1 }]}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity
                style={[styles.btnGen, { backgroundColor: theme.primary }]}
                onPress={generateRandomPassword}
              >
                <Text style={{ color: '#fff', fontSize: 12 }}>Generieren</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              placeholder="Kategorie (z. B. Arbeit, Privat)"
              placeholderTextColor={theme.subtext}
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              value={category}
              onChangeText={setCategory}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: '#888' }]}
                onPress={() => setIsAddModalOpen(false)}
              >
                <Text style={styles.btnText}>Abbrechen</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, { backgroundColor: theme.primary }]}
                onPress={handleAddPassword}
              >
                <Text style={styles.btnText}>Speichern</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={isSettingsOpen} animationType="slide">
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Einstellungen</Text>
            <TouchableOpacity onPress={() => setIsSettingsOpen(false)} style={styles.iconButton}>
              <Text style={{ fontSize: 20, color: theme.primary }}>Fertig</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 16 }}>
            {/* Theme Toggle */}
            <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
              <Text style={[styles.settingText, { color: theme.text }]}>Dunkelmodus</Text>
              <Switch value={isDarkMode} onValueChange={setIsDarkMode} />
            </View>

            {/* Guide Button */}
            <TouchableOpacity
              style={[styles.settingRow, { borderBottomColor: theme.border }]}
              onPress={() => setIsGuideOpen(true)}
            >
              <Text style={[styles.settingText, { color: theme.text }]}>📖 Benutzerhandbuch</Text>
              <Text style={{ color: theme.subtext }}>›</Text>
            </TouchableOpacity>

            {/* Developer Info */}
            <View style={styles.devSection}>
              <Text style={[styles.devTitle, { color: theme.text }]}>Entwicklerinformationen</Text>
              <Text style={[styles.devText, { color: theme.subtext }]}>Entwickler: Özgür Cetin</Text>
              <Text style={[styles.devText, { color: theme.subtext }]}>E-Mail: ozgur.cetin@web.de</Text>
              <Text style={[styles.devText, { color: theme.subtext }]}>Version: 1.0.0 (Expo SDK 51)</Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Manual / Guide Modal */}
      <Modal visible={isGuideOpen} animationType="fade">
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Benutzerhandbuch</Text>
            <TouchableOpacity onPress={() => setIsGuideOpen(false)} style={styles.iconButton}>
              <Text style={{ fontSize: 20, color: theme.primary }}>Schließen</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 16 }}>
            <Text style={[styles.guideHeading, { color: theme.text }]}>1. Passwörter hinzufügen</Text>
            <Text style={[styles.guideText, { color: theme.subtext }]}>
              Tippe unten rechts auf das Plus-Icon (+), um ein neues Passwort einzutragen. Du kannst auch den Button "Generieren" nutzen, um ein sicheres Passwort zu erstellen.
            </Text>

            <Text style={[styles.guideHeading, { color: theme.text }]}>2. Passwörter anzeigen & löschen</Text>
            <Text style={[styles.guideText, { color: theme.subtext }]}>
              Klicke auf "Anzeigen" neben einem Passwort-Eintrag, um das Passwort im Klartext zu sehen. Das Mülleimer-Symbol löscht den jeweiligen Eintrag permanent.
            </Text>

            <Text style={[styles.guideHeading, { color: theme.text }]}>3. Design anpassen</Text>
            <Text style={[styles.guideText, { color: theme.subtext }]}>
              Über das Zahnrad-Icon oben rechts kannst du zwischen Hell- und Dunkelmodus wechseln.
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// Themes
const lightTheme = {
  bg: '#F4F6F9',
  cardBg: '#FFFFFF',
  text: '#1F2937',
  subtext: '#6B7280',
  border: '#E5E7EB',
  primary: '#2563EB',
  tagBg: '#EFF6FF'
};

const darkTheme = {
  bg: '#0F172A',
  cardBg: '#1E293B',
  text: '#F8FAFC',
  subtext: '#94A3B8',
  border: '#334155',
  primary: '#3B82F6',
  tagBg: '#1E3A8A'
};

// Stylesheet
const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold'
  },
  iconButton: {
    padding: 4
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold'
  },
  cardTag: {
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 4
  },
  cardText: {
    marginTop: 8,
    fontSize: 14
  },
  passwordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4
  },
  fabText: {
    color: '#FFF',
    fontSize: 28,
    lineHeight: 30
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20
  },
  modalContent: {
    borderRadius: 16,
    padding: 20
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 14
  },
  btnGen: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 12
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 12
  },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8
  },
  btnText: {
    color: '#FFF',
    fontWeight: 'bold'
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1
  },
  settingText: {
    fontSize: 16
  },
  devSection: {
    marginTop: 32,
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.03)'
  },
  devTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8
  },
  devText: {
    fontSize: 14,
    marginBottom: 4
  },
  guideHeading: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 4
  },
  guideText: {
    fontSize: 14,
    lineHeight: 20
  }
});

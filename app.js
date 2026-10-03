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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@passwords_key_v1';

export default function App() {
  const [passwords, setPasswords] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPasswordId, setShowPasswordId] = useState(null);

  useEffect(() => {
    loadPasswords();
  }, []);

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

  const handleAddPassword = () => {
    if (!title.trim() || !password.trim()) {
      Alert.alert('Hinweis', 'Bitte mindestens Titel und Passwort eingeben.');
      return;
    }

    const newEntry = {
      id: Date.now().toString(),
      title: title.trim(),
      username: username.trim(),
      password: password.trim(),
    };

    const updatedPasswords = [newEntry, ...passwords];
    setPasswords(updatedPasswords);
    savePasswordsToStorage(updatedPasswords);

    setTitle('');
    setUsername('');
    setPassword('');
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Passwort-Manager</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.addButtonText}>+ Neu</Text>
        </TouchableOpacity>
      </View>

      {passwords.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Keine Passwörter gespeichert.</Text>
          <Text style={styles.emptySubtext}>Tippe auf "+ Neu", um einen Eintrag zu erstellen.</Text>
        </View>
      ) : (
        <FlatList
          data={passwords}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isVisible = showPasswordId === item.id;
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <TouchableOpacity onPress={() => handleDeletePassword(item.id)}>
                    <Text style={styles.deleteText}>Löschen</Text>
                  </TouchableOpacity>
                </View>

                {item.username ? (
                  <Text style={styles.cardUser}>Benutzer: {item.username}</Text>
                ) : null}

                <View style={styles.passwordRow}>
                  <Text style={styles.cardPassword}>
                    {isVisible ? item.password : '••••••••••••'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowPasswordId(isVisible ? null : item.id)}
                    style={styles.toggleButton}
                  >
                    <Text style={styles.toggleText}>
                      {isVisible ? 'Verbergen' : 'Anzeigen'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}

      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalTitle}>Neuer Eintrag</Text>

            <Text style={styles.label}>Titel / Dienst</Text>
            <TextInput
              style={styles.input}
              placeholder="z.B. Google, GitHub..."
              placeholderTextColor="#666"
              value={title}
              onChangeText={setTitle}
            />

            <Text style={styles.label}>Benutzername / E-Mail</Text>
            <TextInput
              style={styles.input}
              placeholder="z.B. max@example.com"
              placeholderTextColor="#666"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />

            <Text style={styles.label}>Passwort</Text>
            <TextInput
              style={styles.input}
              placeholder="Passwort eingeben"
              placeholderTextColor="#666"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={false}
            />

            <TouchableOpacity style={styles.generateButton} onPress={generatePassword}>
              <Text style={styles.generateButtonText}>Sicheres Passwort generieren</Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalBtnText}>Abbrechen</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.saveBtn]}
                onPress={handleAddPassword}
              >
                <Text style={styles.modalBtnText}>Speichern</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#1E1E1E',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
  },
  addButton: {
    backgroundColor: '#007ACC',
    paddingHorizontal: 15,
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
    color: '#888',
    fontSize: 18,
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#555',
    fontSize: 14,
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
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
    color: '#FFF',
  },
  deleteText: {
    color: '#FF5252',
    fontSize: 14,
  },
  cardUser: {
    color: '#AAA',
    fontSize: 14,
    marginBottom: 8,
  },
  passwordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    padding: 10,
    borderRadius: 6,
  },
  cardPassword: {
    color: '#4CAF50',
    fontFamily: 'monospace',
    fontSize: 15,
  },
  toggleButton: {
    padding: 4,
  },
  toggleText: {
    color: '#007ACC',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  label: {
    color: '#CCC',
    marginBottom: 6,
    fontSize: 14,
  },
  input: {
    backgroundColor: '#2A2A2A',
    color: '#FFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
    fontSize: 16,
  },
  generateButton: {
    backgroundColor: '#333',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#007ACC',
  },
  generateButtonText: {
    color: '#007ACC',
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
  cancelBtn: {
    backgroundColor: '#444',
  },
  saveBtn: {
    backgroundColor: '#007ACC',
  },
  modalBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
});

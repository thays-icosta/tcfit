import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Share, Modal, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { supabase } from './supabaseClient';
import PersonalProfileScreen from './PersonalProfileScreen';
import PersonalAgendaScreen from './PersonalAgendaScreen';
import PersonalChatListScreen from './PersonalChatListScreen';
import PersonalFinanceScreen from './PersonalFinanceScreen';
import TemplateBuilderScreen from './TemplateBuilderScreen';
import RecipeManagerScreen from './RecipeManagerScreen';
import FoodCatalogScreen from './FoodCatalogScreen';
import AlunoDetailScreen from './AlunoDetailScreen';
import { showAlert } from './alertUtils';

export default function PersonalHomeScreen({ user, onLogout }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ownAvatarUrl, setOwnAvatarUrl] = useState(null);
  const [completedToday, setCompletedToday] = useState({});
  const [daysSinceLastTrained, setDaysSinceLastTrained] = useState({});
  const [detailFor, setDetailFor] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showAgenda, setShowAgenda] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showFinance, setShowFinance] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showRecipes, setShowRecipes] = useState(false);
  const [showFoodCatalog, setShowFoodCatalog] = useState(false);
  const [justCopied, setJustCopied] = useState(false);
  const [financeSummary, setFinanceSummary] = useState({ monthlyRevenue: 0, dueCount: 0 });

  const todayStr = new Date().toISOString().slice(0, 10);

  const handleCopyInvite = async () => {
    await Clipboard.setStringAsync(user.id);
    setJustCopied(true);
    setTimeout(() => setJustCopied(false), 2000);
  };

  const handleShareInvite = async () => {
    try {
      await Share.share({
        message: `Olá! Baixe o app e use meu código de convite: ${user.id}`,
      });
    } catch (e) {
      showAlert('Erro', 'Não foi possível abrir o compartilhamento.');
    }
  };

  const loadOwnProfile = async () => {
    const { data } = await supabase.from('users').select('avatar_url').eq('id', user.id).single();
    setOwnAvatarUrl(data?.avatar_url || null);
  };

  const loadFinanceSummary = async () => {
    const { data } = await supabase
      .from('payments')
      .select('amount, paid, paid_at')
      .eq('personal_id', user.id);

    const rows = data || [];
    const monthPrefix = todayStr.slice(0, 7);
    const monthlyRevenue = rows
      .filter((p) => p.paid && p.paid_at && p.paid_at.slice(0, 7) === monthPrefix)
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const dueCount = rows.filter((p) => !p.paid).length;
    setFinanceSummary({ monthlyRevenue, dueCount });
  };

  const loadStudents = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, avatar_url')
      .eq('personal_id', user.id)
      .eq('role', 'aluno');

    if (error) {
      showAlert('Erro ao carregar alunos', error.message);
    }
    if (!error) setStudents(data || []);

    const studentIds = (data || []).map((s) => s.id);
    if (studentIds.length > 0) {
      const { data: completions } = await supabase
        .from('workout_completions')
        .select('student_id')
        .in('student_id', studentIds)
        .gte('completed_at', `${todayStr}T00:00:00`);

      const map = {};
      (completions || []).forEach((c) => { map[c.student_id] = true; });
      setCompletedToday(map);

      const { data: allCompletions } = await supabase
        .from('workout_completions')
        .select('student_id, completed_at')
        .in('student_id', studentIds)
        .order('completed_at', { ascending: false });

      const lastMap = {};
      (allCompletions || []).forEach((c) => {
        if (!(c.student_id in lastMap)) lastMap[c.student_id] = c.completed_at;
      });

      const now = new Date();
      const daysMap = {};
      studentIds.forEach((id) => {
        if (lastMap[id]) {
          daysMap[id] = Math.floor((now - new Date(lastMap[id])) / (1000 * 60 * 60 * 24));
        } else {
          daysMap[id] = null;
        }
      });
      setDaysSinceLastTrained(daysMap);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadStudents();
    loadOwnProfile();
    loadFinanceSummary();
  }, [user.id]);

  if (detailFor) {
    return (
      <AlunoDetailScreen
        student={detailFor}
        personalId={user.id}
        onClose={() => {
          setDetailFor(null);
          loadStudents();
        }}
      />
    );
  }

  if (showProfile) {
    return (
      <PersonalProfileScreen
        user={user}
        onLogout={onLogout}
        onClose={() => {
          setShowProfile(false);
          loadStudents();
          loadOwnProfile();
        }}
      />
    );
  }

  if (showAgenda) {
    return (
      <PersonalAgendaScreen
        personalId={user.id}
        onClose={() => setShowAgenda(false)}
      />
    );
  }

  if (showChat) {
    return (
      <PersonalChatListScreen
        personalId={user.id}
        onClose={() => setShowChat(false)}
      />
    );
  }

  if (showFinance) {
    return (
      <PersonalFinanceScreen
        personalId={user.id}
        onClose={() => {
          setShowFinance(false);
          loadFinanceSummary();
        }}
      />
    );
  }

  if (showTemplates) {
    return <TemplateBuilderScreen personalId={user.id} onClose={() => setShowTemplates(false)} />;
  }

  if (showRecipes) {
    return <RecipeManagerScreen personalId={user.id} onClose={() => setShowRecipes(false)} />;
  }

  if (showFoodCatalog) {
    return (
      <FoodCatalogScreen
        onAddFood={() => showAlert('Catálogo de Alimentos', 'Esse é o catálogo geral usado nas dietas. Pra montar a dieta de um aluno específico, acesse o perfil dele.')}
        onClose={() => setShowFoodCatalog(false)}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => setShowProfile(true)}>
            <View style={styles.ownAvatarCircle}>
              {ownAvatarUrl ? (
                <Image key={ownAvatarUrl} source={{ uri: ownAvatarUrl }} style={styles.ownAvatarImage} resizeMode="cover" />
              ) : (
                <Text style={styles.ownAvatarLetter}>{user?.name?.charAt(0).toUpperCase() || '?'}</Text>
              )}
            </View>
          </TouchableOpacity>
          <View>
            <Text style={styles.badge}>PERSONAL</Text>
            <Text style={styles.greeting}>Olá, {user?.name}!</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.inviteButton} onPress={() => setShowInviteModal(true)}>
          <Text style={styles.inviteButtonText}>+ Convidar Aluno</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>R$ {financeSummary.monthlyRevenue.toFixed(2)}</Text>
          <Text style={styles.summaryLabel}>Faturamento Mensal</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{students.length}</Text>
          <Text style={styles.summaryLabel}>{students.length === 1 ? 'Aluno Ativo' : 'Alunos Ativos'}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{financeSummary.dueCount}</Text>
          <Text style={styles.summaryLabel}>A Vencer</Text>
        </View>
      </View>

      <View style={styles.shortcutGrid}>
        <TouchableOpacity style={styles.shortcutCard} onPress={() => setShowTemplates(true)}>
          <View style={styles.shortcutIconCircle}>
            <Ionicons name="barbell-outline" size={20} color="#f97316" />
          </View>
          <Text style={styles.shortcutText}>Biblioteca de Treinos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shortcutCard} onPress={() => setShowFoodCatalog(true)}>
          <View style={styles.shortcutIconCircle}>
            <Ionicons name="nutrition-outline" size={20} color="#f97316" />
          </View>
          <Text style={styles.shortcutText}>Dietas</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shortcutCard} onPress={() => setShowRecipes(true)}>
          <View style={styles.shortcutIconCircle}>
            <Ionicons name="restaurant-outline" size={20} color="#f97316" />
          </View>
          <Text style={styles.shortcutText}>Receitas</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shortcutCard} onPress={() => setShowFinance(true)}>
          <View style={styles.shortcutIconCircle}>
            <Ionicons name="cash-outline" size={20} color="#f97316" />
          </View>
          <Text style={styles.shortcutText}>Financeiro</Text>
        </TouchableOpacity>
      </View>

      {students.length > 0 && (
        <View style={styles.bannerRow}>
          <TouchableOpacity style={[styles.agendaBanner, { flex: 1, marginRight: 8 }]} onPress={() => setShowAgenda(true)}>
            <Ionicons name="calendar-outline" size={16} color="#a855f7" />
            <Text style={styles.agendaBannerTitle}>Agenda</Text>
            <Text style={styles.agendaBannerSubtitle}>Ver sessões</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.chatBanner, { flex: 1 }]} onPress={() => setShowChat(true)}>
            <Ionicons name="chatbubbles-outline" size={16} color="#22c55e" />
            <Text style={styles.chatBannerTitle}>Mensagens</Text>
            <Text style={styles.chatBannerSubtitle}>Falar com alunos</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.sectionTitle}>Meus Alunos</Text>

      {loading ? (
        <ActivityIndicator color="#f97316" style={{ marginTop: 20 }} />
      ) : students.length === 0 ? (
        <Text style={styles.emptyText}>Nenhum aluno ainda. Toque em "+ Convidar Aluno" pra começar.</Text>
      ) : (
        <FlatList
          data={students}
          keyExtractor={(item) => item.id}
          style={{ width: '100%' }}
          renderItem={({ item }) => {
            const done = completedToday[item.id];
            const daysSince = daysSinceLastTrained[item.id];
            const showAlert = !done && (daysSince === null || daysSince >= 3);
            return (
              <TouchableOpacity style={styles.studentCard} onPress={() => setDetailFor(item)}>
                <View style={styles.avatarCircle}>
                  {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarLetter}>{item.name?.charAt(0).toUpperCase() || '?'}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.studentName}>{item.name}</Text>
                  <Text style={styles.studentEmail}>{item.email}</Text>
                </View>
                <View style={styles.statusTag}>
                  <View style={[styles.statusDot, done ? styles.statusDotDone : styles.statusDotPending]} />
                  <Text style={styles.statusTagText}>{done ? 'Treinou hoje' : 'Ainda não treinou'}</Text>
                  {showAlert && (
                    <View style={styles.alertTag}>
                      <Text style={styles.alertTagText}>
                        {daysSince === null ? 'Nunca treinou' : `${daysSince}d sem treinar`}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <TouchableOpacity style={styles.button} onPress={onLogout}>
        <Text style={styles.buttonText}>Sair</Text>
      </TouchableOpacity>

      <Modal visible={showInviteModal} transparent animationType="slide" onRequestClose={() => setShowInviteModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Convidar Aluno</Text>
            <Text style={styles.modalSubtitle}>Compartilhe esse código pro aluno usar no cadastro:</Text>
            <View style={styles.modalCodeBox}>
              <Text style={styles.modalCodeText}>{user.id}</Text>
            </View>
            <TouchableOpacity style={[styles.modalButton, justCopied && styles.modalButtonDone]} onPress={handleCopyInvite}>
              <Text style={styles.modalButtonText}>{justCopied ? 'Copiado!' : 'Copiar código'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalButton} onPress={handleShareInvite}>
              <Text style={styles.modalButtonText}>Compartilhar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowInviteModal(false)}>
              <Text style={styles.modalCloseButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 24, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  ownAvatarCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#171717', borderWidth: 1, borderColor: '#f97316', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginRight: 10 },
  ownAvatarImage: { width: 44, height: 44 },
  ownAvatarLetter: { color: '#f97316', fontSize: 16, fontWeight: '800' },
  badge: { color: '#f97316', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  greeting: { color: '#f5f5f5', fontSize: 19, fontWeight: '700' },
  inviteButton: { backgroundColor: 'rgba(249,115,22,0.12)', borderWidth: 1, borderColor: '#f97316', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  inviteButtonText: { color: '#f97316', fontSize: 12, fontWeight: '700' },
  summaryCard: { flexDirection: 'row', backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, paddingVertical: 14, marginBottom: 12 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, backgroundColor: '#292524' },
  summaryValue: { color: '#f5f5f5', fontSize: 16, fontWeight: '800' },
  summaryLabel: { color: '#737373', fontSize: 9, marginTop: 4, textAlign: 'center' },
  shortcutGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  shortcutCard: { width: '47%', backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 14, paddingVertical: 16, alignItems: 'center', gap: 8 },
  shortcutIconCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(249,115,22,0.12)', alignItems: 'center', justifyContent: 'center' },
  shortcutText: { color: '#f5f5f5', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  bannerRow: { flexDirection: 'row', marginBottom: 10 },
  agendaBanner: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#a855f7', borderRadius: 12, padding: 14 },
  agendaBannerTitle: { color: '#a855f7', fontSize: 13, fontWeight: '700', marginTop: 4 },
  agendaBannerSubtitle: { color: '#a3a3a3', fontSize: 11, marginTop: 2 },
  chatBanner: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#22c55e', borderRadius: 12, padding: 14 },
  chatBannerTitle: { color: '#22c55e', fontSize: 13, fontWeight: '700', marginTop: 4 },
  chatBannerSubtitle: { color: '#a3a3a3', fontSize: 11, marginTop: 2 },
  sectionTitle: { color: '#f5f5f5', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  emptyText: { color: '#737373', fontSize: 13, textAlign: 'center', marginTop: 12 },
  studentCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 14, padding: 14, marginBottom: 10 },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', alignItems: 'center', justifyContent: 'center', marginRight: 12, overflow: 'hidden' },
  avatarImage: { width: 44, height: 44 },
  avatarLetter: { color: '#f97316', fontSize: 17, fontWeight: '800' },
  studentName: { color: '#f5f5f5', fontSize: 15, fontWeight: '600' },
  studentEmail: { color: '#737373', fontSize: 11, marginTop: 1 },
  statusTag: { alignItems: 'flex-end', marginRight: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 3 },
  statusDotDone: { backgroundColor: '#22c55e' },
  statusDotPending: { backgroundColor: '#525252' },
  statusTagText: { color: '#525252', fontSize: 9 },
  alertTag: { backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, marginTop: 4 },
  alertTagText: { color: '#ef4444', fontSize: 9, fontWeight: '700' },
  chevron: { color: '#525252', fontSize: 22, fontWeight: '300' },
  button: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 20 },
  buttonText: { color: '#f97316', fontSize: 15, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#171717', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { color: '#f5f5f5', fontSize: 18, fontWeight: '800', marginBottom: 6 },
  modalSubtitle: { color: '#a3a3a3', fontSize: 12, marginBottom: 16 },
  modalCodeBox: { backgroundColor: '#0a0a0a', borderRadius: 10, padding: 14, marginBottom: 16 },
  modalCodeText: { color: '#f97316', fontSize: 11, fontFamily: 'Courier' },
  modalButton: { backgroundColor: '#0a0a0a', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  modalButtonDone: { backgroundColor: 'rgba(34,197,94,0.15)' },
  modalButtonText: { color: '#f97316', fontSize: 13, fontWeight: '700' },
  modalCloseButton: { paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  modalCloseButtonText: { color: '#a3a3a3', fontSize: 13, fontWeight: '600' },
});
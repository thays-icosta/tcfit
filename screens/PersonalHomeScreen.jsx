import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Share, Modal, Image, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { supabase } from './supabaseClient';
import PersonalProfileScreen from './PersonalProfileScreen';
import PersonalAgendaScreen from './PersonalAgendaScreen';
import PersonalChatListScreen from './PersonalChatListScreen';
import PersonalFinanceScreen from './PersonalFinanceScreen';
import TemplateBuilderScreen from './TemplateBuilderScreen';
import ProductsManagerScreen from './ProductsManagerScreen';
import FoodCatalogScreen from './FoodCatalogScreen';
import RecipeManagerScreen from './RecipeManagerScreen';
import AlunoDetailScreen from './AlunoDetailScreen';
import PersonalTabBar from './PersonalTabBar';
import { showAlert } from './alertUtils';
import { HeaderWelcome } from './Header';

export default function PersonalHomeScreen({ user, onLogout, initialChatStudentId, onConsumeInitialChat }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ownAvatarUrl, setOwnAvatarUrl] = useState(null);
  const [completedToday, setCompletedToday] = useState({});
  const [daysSinceLastTrained, setDaysSinceLastTrained] = useState({});
  const [detailFor, setDetailFor] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [activeTab, setActiveTab] = useState('inicio');
  const [showAgenda, setShowAgenda] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showFinance, setShowFinance] = useState(false);
  const [showProductsManager, setShowProductsManager] = useState(false);
  const [showFoodCatalog, setShowFoodCatalog] = useState(false);
  const [showRecipeManager, setShowRecipeManager] = useState(false);
  const [showStudentPicker, setShowStudentPicker] = useState(false);
  const [justCopied, setJustCopied] = useState(false);
  const [financeSummary, setFinanceSummary] = useState({ monthlyRevenue: 0, dueCount: 0 });
  const [studentFilter, setStudentFilter] = useState('todos');
  const [studentSearch, setStudentSearch] = useState('');
  const [recentDiets, setRecentDiets] = useState([]);

  const todayStr = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (initialChatStudentId) {
      setShowChat(true);
    }
  }, [initialChatStudentId]);

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
      .select('id, name, email, avatar_url, access_level')
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

  const loadRecentDiets = async () => {
    const { data } = await supabase
      .from('diets')
      .select('id, name, active, created_at, student:student_id(id, name)')
      .eq('personal_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);
    setRecentDiets(data || []);
  };

  useEffect(() => {
    loadStudents();
    loadOwnProfile();
    loadFinanceSummary();
    loadRecentDiets();
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

  if (activeTab === 'perfil') {
    return (
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <PersonalProfileScreen
            user={user}
            onLogout={onLogout}
            onClose={() => {
              setActiveTab('inicio');
              loadStudents();
              loadOwnProfile();
            }}
          />
        </View>
        <PersonalTabBar activeTab={activeTab} onChange={setActiveTab} />
      </View>
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
        initialStudentId={initialChatStudentId}
        onConsumeInitialStudent={onConsumeInitialChat}
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

  if (activeTab === 'treinos') {
    return (
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <TemplateBuilderScreen personalId={user.id} onClose={() => setActiveTab('inicio')} />
        </View>
        <PersonalTabBar activeTab={activeTab} onChange={setActiveTab} />
      </View>
    );
  }

  if (showProductsManager) {
    return <ProductsManagerScreen personalId={user.id} onClose={() => setShowProductsManager(false)} />;
  }

  if (showFoodCatalog) {
    return (
      <FoodCatalogScreen
        onAddFood={() => showAlert('Catálogo de Alimentos', 'Esse é o catálogo geral usado nas dietas. Pra montar a dieta de um aluno específico, acesse o perfil dele.')}
        onClose={() => setShowFoodCatalog(false)}
      />
    );
  }

  if (showRecipeManager) {
    return <RecipeManagerScreen personalId={user.id} onClose={() => setShowRecipeManager(false)} />;
  }

  const filteredStudents = students
    .filter((s) => {
      if (studentFilter === 'vip') return s.access_level === 'consultoria_vip';
      if (studentFilter === 'app') return s.access_level !== 'consultoria_vip';
      return true;
    })
    .filter((s) => {
      const q = studentSearch.trim().toLowerCase();
      if (!q) return true;
      return s.name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q);
    });

  if (activeTab === 'alunos') {
    return (
      <View style={{ flex: 1 }}>
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Meus Alunos</Text>

          <View style={styles.studentFilterTabs}>
            {[
              { value: 'todos', label: 'Todos' },
              { value: 'vip', label: 'Consultoria VIP' },
              { value: 'app', label: 'Membros do App' },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.value}
                style={[styles.studentFilterTab, studentFilter === tab.value && styles.studentFilterTabActive]}
                onPress={() => setStudentFilter(tab.value)}
              >
                <Text style={[styles.studentFilterTabText, studentFilter === tab.value && styles.studentFilterTabTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.studentSearchBox}>
            <Ionicons name="search-outline" size={16} color="#737373" />
            <TextInput
              style={styles.studentSearchInput}
              placeholder="Buscar por nome ou e-mail"
              placeholderTextColor="#525252"
              value={studentSearch}
              onChangeText={setStudentSearch}
            />
            {studentSearch.length > 0 && (
              <TouchableOpacity hitSlop={8} onPress={() => setStudentSearch('')}>
                <Ionicons name="close-circle" size={16} color="#525252" />
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <ActivityIndicator color="#f97316" style={{ marginTop: 20 }} />
          ) : students.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum aluno ainda. Toque em &quot;+ Aluno&quot; na Início pra começar.</Text>
          ) : filteredStudents.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum aluno encontrado.</Text>
          ) : (
            filteredStudents.map((item) => {
              const done = completedToday[item.id];
              const daysSince = daysSinceLastTrained[item.id];
              const showAlertTag = !done && (daysSince === null || daysSince >= 3);
              const isVip = item.access_level === 'consultoria_vip';
              return (
                <TouchableOpacity key={item.id} style={styles.studentCard} onPress={() => setDetailFor(item)}>
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
                    <View style={[styles.planBadge, isVip ? styles.planBadgeVip : styles.planBadgeApp]}>
                      <Text style={[styles.planBadgeText, isVip ? styles.planBadgeTextVip : styles.planBadgeTextApp]}>
                        {isVip ? 'Consultoria VIP' : 'Acesso App'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.statusTag}>
                    <View style={[styles.statusDot, done ? styles.statusDotDone : styles.statusDotPending]} />
                    <Text style={styles.statusTagText}>{done ? 'Treinou hoje' : 'Ainda não treinou'}</Text>
                    {showAlertTag && (
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
            })
          )}
        </ScrollView>
        <PersonalTabBar activeTab={activeTab} onChange={setActiveTab} />
      </View>
    );
  }

  if (activeTab === 'nutricao') {
    return (
      <View style={{ flex: 1 }}>
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Nutrição</Text>

          <TouchableOpacity style={styles.aiShortcutCard} onPress={() => setShowStudentPicker(true)}>
            <Ionicons name="sparkles" size={20} color="#f97316" />
            <View style={{ flex: 1 }}>
              <Text style={styles.aiShortcutTitle}>Gerar Dieta com IA</Text>
              <Text style={styles.aiShortcutSubtitle}>Escolha um aluno e monte um plano alimentar automaticamente</Text>
            </View>
            <Ionicons name="chevron-forward-outline" size={18} color="#525252" />
          </TouchableOpacity>

          <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Biblioteca de Dietas e Receitas</Text>
          <View style={styles.shortcutGrid}>
            <TouchableOpacity style={styles.shortcutCard} onPress={() => setShowFoodCatalog(true)}>
              <View style={styles.shortcutIconCircle}>
                <Ionicons name="nutrition-outline" size={20} color="#f97316" />
              </View>
              <Text style={styles.shortcutText}>Catálogo de Alimentos</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shortcutCard} onPress={() => setShowRecipeManager(true)}>
              <View style={styles.shortcutIconCircle}>
                <Ionicons name="book-outline" size={20} color="#f97316" />
              </View>
              <Text style={styles.shortcutText}>Receitas e E-books</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Planos Recentes</Text>
          {recentDiets.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum plano alimentar criado ainda.</Text>
          ) : (
            recentDiets.map((diet) => (
              <TouchableOpacity
                key={diet.id}
                style={styles.recentDietCard}
                onPress={() => diet.student && setDetailFor(students.find((s) => s.id === diet.student.id) || diet.student)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.recentDietName}>{diet.name}</Text>
                  <Text style={styles.recentDietStudent}>{diet.student?.name || 'Aluno removido'}</Text>
                </View>
                {diet.active && (
                  <View style={styles.recentDietActiveBadge}>
                    <Text style={styles.recentDietActiveBadgeText}>Ativo</Text>
                  </View>
                )}
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
        <PersonalTabBar activeTab={activeTab} onChange={setActiveTab} />

        <Modal visible={showStudentPicker} transparent animationType="slide" onRequestClose={() => setShowStudentPicker(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>Escolha um aluno</Text>
              <Text style={styles.modalSubtitle}>Você vai gerar a dieta na tela de perfil desse aluno.</Text>
              <ScrollView style={{ maxHeight: 320 }}>
                {students.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={styles.studentPickerRow}
                    onPress={() => {
                      setShowStudentPicker(false);
                      setDetailFor(s);
                    }}
                  >
                    <Text style={styles.studentPickerName}>{s.name}</Text>
                    <Text style={styles.chevron}>›</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowStudentPicker(false)}>
                <Text style={styles.modalCloseButtonText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <HeaderWelcome
        avatarUrl={ownAvatarUrl}
        initial={user?.name?.charAt(0).toUpperCase() || '?'}
        badge="PERSONAL"
        greeting={`Olá, ${user?.name}!`}
        onAvatarPress={() => setActiveTab('perfil')}
        rightSlot={
          <TouchableOpacity style={styles.inviteButton} onPress={() => setShowInviteModal(true)}>
            <Text style={styles.inviteButtonText}>+ Aluno</Text>
          </TouchableOpacity>
        }
      />

      <TouchableOpacity style={styles.summaryCard} onPress={() => setShowFinance(true)} activeOpacity={0.7}>
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
      </TouchableOpacity>

      <View style={styles.shortcutGrid}>
        <TouchableOpacity style={styles.shortcutCard} onPress={() => setActiveTab('treinos')}>
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
        <TouchableOpacity style={styles.shortcutCard} onPress={() => setShowProductsManager(true)}>
          <View style={styles.shortcutIconCircle}>
            <Ionicons name="bag-handle-outline" size={20} color="#f97316" />
          </View>
          <Text style={styles.shortcutText}>Produtos Adicionais</Text>
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

      <TouchableOpacity style={styles.viewStudentsRow} onPress={() => setActiveTab('alunos')}>
        <Ionicons name="people-outline" size={18} color="#f97316" />
        <View style={{ flex: 1 }}>
          <Text style={styles.viewStudentsTitle}>Meus Alunos</Text>
          <Text style={styles.viewStudentsSubtitle}>
            {students.length} aluno{students.length !== 1 ? 's' : ''} · ver lista completa
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

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
    </ScrollView>
      <PersonalTabBar activeTab={activeTab} onChange={setActiveTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 24 },
  inviteButton: { backgroundColor: 'rgba(249,115,22,0.12)', borderWidth: 1, borderColor: '#f97316', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  inviteButtonText: { color: '#f97316', fontSize: 12, fontWeight: '600' },
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
  sectionTitleSpaced: { marginTop: 20 },
  emptyText: { color: '#737373', fontSize: 13, textAlign: 'center', marginTop: 12 },
  viewStudentsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 14, padding: 14, marginTop: 4 },
  viewStudentsTitle: { color: '#f5f5f5', fontSize: 14, fontWeight: '700' },
  viewStudentsSubtitle: { color: '#a3a3a3', fontSize: 11, marginTop: 2 },
  aiShortcutCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(249,115,22,0.1)', borderWidth: 1, borderColor: '#f97316', borderRadius: 14, padding: 16, marginBottom: 8 },
  aiShortcutTitle: { color: '#f5f5f5', fontSize: 14, fontWeight: '700' },
  aiShortcutSubtitle: { color: '#a3a3a3', fontSize: 11, marginTop: 2 },
  recentDietCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 14, marginBottom: 10 },
  recentDietName: { color: '#f5f5f5', fontSize: 13, fontWeight: '700' },
  recentDietStudent: { color: '#737373', fontSize: 11, marginTop: 2 },
  recentDietActiveBadge: { backgroundColor: 'rgba(34,197,94,0.12)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  recentDietActiveBadgeText: { color: '#22c55e', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  studentPickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#292524' },
  studentPickerName: { color: '#f5f5f5', fontSize: 14, fontWeight: '600' },
  studentFilterTabs: { flexDirection: 'row', backgroundColor: '#171717', borderRadius: 10, padding: 3, marginBottom: 10, gap: 4 },
  studentFilterTab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 8 },
  studentFilterTabActive: { backgroundColor: '#f97316' },
  studentFilterTabText: { color: '#a3a3a3', fontSize: 11, fontWeight: '600', textAlign: 'center' },
  studentFilterTabTextActive: { color: '#0a0a0a' },
  studentSearchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14 },
  studentSearchInput: { flex: 1, color: '#f5f5f5', fontSize: 13 },
  studentCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 14, padding: 14, marginBottom: 10 },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', alignItems: 'center', justifyContent: 'center', marginRight: 12, overflow: 'hidden' },
  avatarImage: { width: 44, height: 44 },
  avatarLetter: { color: '#f97316', fontSize: 17, fontWeight: '800' },
  studentName: { color: '#f5f5f5', fontSize: 15, fontWeight: '600' },
  studentEmail: { color: '#737373', fontSize: 11, marginTop: 1 },
  planBadge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, marginTop: 5 },
  planBadgeVip: { backgroundColor: 'rgba(168,85,247,0.12)' },
  planBadgeApp: { backgroundColor: 'rgba(115,115,115,0.16)' },
  planBadgeText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  planBadgeTextVip: { color: '#a855f7' },
  planBadgeTextApp: { color: '#a3a3a3' },
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
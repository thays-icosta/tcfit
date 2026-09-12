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
import DietTemplateBuilderScreen from './DietTemplateBuilderScreen';
import ProjectTemplateBuilderScreen from './ProjectTemplateBuilderScreen';
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
  const [overduePaymentStudents, setOverduePaymentStudents] = useState({});
  const [anamnesePendingStudents, setAnamnesePendingStudents] = useState({});
  const [unreadMessageStudents, setUnreadMessageStudents] = useState({});
  const [staleWorkoutStudents, setStaleWorkoutStudents] = useState({});
  const [assessmentOverdueStudents, setAssessmentOverdueStudents] = useState({});
  const [cycleCompletedStudents, setCycleCompletedStudents] = useState({});
  const [lastTrainedDate, setLastTrainedDate] = useState({});
  const [detailFor, setDetailFor] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [activeTab, setActiveTab] = useState('inicio');
  const [showAgenda, setShowAgenda] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showFinance, setShowFinance] = useState(false);
  const [showProductsManager, setShowProductsManager] = useState(false);
  const [showFoodCatalog, setShowFoodCatalog] = useState(false);
  const [showRecipeManager, setShowRecipeManager] = useState(false);
  const [showDietTemplates, setShowDietTemplates] = useState(false);
  const [showProjectBuilder, setShowProjectBuilder] = useState(false);
  const [nutricaoScope, setNutricaoScope] = useState('planos');
  const [showStudentPicker, setShowStudentPicker] = useState(false);
  const [justCopied, setJustCopied] = useState(false);
  const [financeSummary, setFinanceSummary] = useState({ monthlyRevenue: 0, dueCount: 0 });
  const [studentFilter, setStudentFilter] = useState('todos');
  const [attendanceFilter, setAttendanceFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [showMoreFilters, setShowMoreFilters] = useState(false);
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
    } catch {
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
      .select('id, name, email, phone, avatar_url, access_level, attendance_mode')
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
      setLastTrainedDate(lastMap);

      const { data: overdueRows } = await supabase
        .from('payments')
        .select('student_id')
        .eq('personal_id', user.id)
        .eq('paid', false)
        .lt('due_date', todayStr);
      const overdueMap = {};
      (overdueRows || []).forEach((p) => { overdueMap[p.student_id] = true; });
      setOverduePaymentStudents(overdueMap);

      const { data: anamneseRows } = await supabase
        .from('anamnese_responses')
        .select('student_id, completed_at')
        .in('student_id', studentIds);
      const completedSet = new Set((anamneseRows || []).filter((a) => a.completed_at).map((a) => a.student_id));
      const pendingMap = {};
      studentIds.forEach((id) => { if (!completedSet.has(id)) pendingMap[id] = true; });
      setAnamnesePendingStudents(pendingMap);

      const { data: unreadRows } = await supabase
        .from('messages')
        .select('student_id')
        .eq('personal_id', user.id)
        .eq('read', false)
        .neq('sender_id', user.id);
      const unreadMap = {};
      (unreadRows || []).forEach((m) => { unreadMap[m.student_id] = true; });
      setUnreadMessageStudents(unreadMap);

      const { data: activeWorkoutRows } = await supabase
        .from('workouts')
        .select('student_id, created_at')
        .eq('personal_id', user.id)
        .eq('active', true)
        .in('student_id', studentIds);
      const oldestByStudent = {};
      (activeWorkoutRows || []).forEach((w) => {
        const t = new Date(w.created_at).getTime();
        if (!(w.student_id in oldestByStudent) || t < oldestByStudent[w.student_id]) oldestByStudent[w.student_id] = t;
      });
      const staleMap = {};
      Object.keys(oldestByStudent).forEach((id) => {
        const weeks = Math.floor((Date.now() - oldestByStudent[id]) / (7 * 24 * 60 * 60 * 1000));
        if (weeks >= 6) staleMap[id] = weeks;
      });
      setStaleWorkoutStudents(staleMap);

      // Only flags a *stale* assessment (one existed before and is now old) —
      // never nags about a workflow a student simply never had.
      const { data: assessmentRows } = await supabase
        .from('physical_assessments')
        .select('student_id, created_at')
        .in('student_id', studentIds)
        .order('created_at', { ascending: false });
      const lastAssessmentByStudent = {};
      (assessmentRows || []).forEach((a) => {
        if (!(a.student_id in lastAssessmentByStudent)) lastAssessmentByStudent[a.student_id] = a.created_at;
      });
      const ASSESSMENT_OVERDUE_WEEKS = 8;
      const assessmentMap = {};
      Object.keys(lastAssessmentByStudent).forEach((id) => {
        const weeks = Math.floor((Date.now() - new Date(lastAssessmentByStudent[id]).getTime()) / (7 * 24 * 60 * 60 * 1000));
        if (weeks >= ASSESSMENT_OVERDUE_WEEKS) assessmentMap[id] = weeks;
      });
      setAssessmentOverdueStudents(assessmentMap);

      const { data: planRows } = await supabase
        .from('periodization_plans')
        .select('student_id, start_date, total_weeks, created_at')
        .in('student_id', studentIds)
        .order('created_at', { ascending: false });
      const planByStudent = {};
      (planRows || []).forEach((p) => {
        if (!(p.student_id in planByStudent)) planByStudent[p.student_id] = p;
      });
      const cycleMap = {};
      Object.entries(planByStudent).forEach(([id, p]) => {
        const endDate = new Date(p.start_date);
        endDate.setDate(endDate.getDate() + p.total_weeks * 7);
        if (Date.now() >= endDate.getTime()) cycleMap[id] = p.total_weeks;
      });
      setCycleCompletedStudents(cycleMap);
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
        personalName={user.name}
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
          <TemplateBuilderScreen personalId={user.id} onClose={() => setActiveTab('inicio')} onCreateForStudent={() => setActiveTab('alunos')} />
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

  if (showDietTemplates) {
    return <DietTemplateBuilderScreen personalId={user.id} onClose={() => setShowDietTemplates(false)} />;
  }

  if (showProjectBuilder) {
    return <ProjectTemplateBuilderScreen personalId={user.id} onClose={() => setShowProjectBuilder(false)} />;
  }

  const attentionItems = students
    .map((s) => {
      const done = completedToday[s.id];
      const daysSince = daysSinceLastTrained[s.id];
      const flags = [];
      if (!done && (daysSince === null || daysSince >= 3)) {
        flags.push({ key: 'inatividade', tone: 'urgent', label: daysSince === null ? 'Nunca treinou' : `${daysSince}d sem treinar` });
      }
      if (overduePaymentStudents[s.id]) {
        flags.push({ key: 'pagamento', tone: 'pending', label: 'Pagamento vencido' });
      }
      if (anamnesePendingStudents[s.id]) {
        flags.push({ key: 'anamnese', tone: 'pending', label: 'Anamnese pendente' });
      }
      if (unreadMessageStudents[s.id]) {
        flags.push({ key: 'mensagem', tone: 'pending', label: 'Mensagem não respondida' });
      }
      if (staleWorkoutStudents[s.id] != null) {
        flags.push({ key: 'treino_desatualizado', tone: 'pending', label: `Treino há ${staleWorkoutStudents[s.id]}sem sem atualizar` });
      }
      if (assessmentOverdueStudents[s.id] != null) {
        flags.push({ key: 'avaliacao', tone: 'pending', label: `Avaliação física há ${assessmentOverdueStudents[s.id]}sem` });
      }
      if (cycleCompletedStudents[s.id] != null) {
        flags.push({ key: 'ciclo_concluido', tone: 'pending', label: `Ciclo de ${cycleCompletedStudents[s.id]}sem concluído` });
      }
      return { student: s, flags };
    })
    .filter((item) => item.flags.length > 0)
    .sort((a, b) => (b.flags.some((f) => f.tone === 'urgent') ? 1 : 0) - (a.flags.some((f) => f.tone === 'urgent') ? 1 : 0));

  const studentStatus = (s) => {
    if (overduePaymentStudents[s.id]) return 'atrasado';
    const done = completedToday[s.id];
    const daysSince = daysSinceLastTrained[s.id];
    if (
      (!done && (daysSince === null || daysSince >= 3)) ||
      anamnesePendingStudents[s.id] ||
      unreadMessageStudents[s.id] ||
      staleWorkoutStudents[s.id] != null ||
      assessmentOverdueStudents[s.id] != null ||
      cycleCompletedStudents[s.id] != null
    ) return 'atencao';
    return 'em_dia';
  };

  const filteredStudents = students
    .filter((s) => {
      if (studentFilter === 'vip') return s.access_level === 'consultoria_vip';
      if (studentFilter === 'app') return s.access_level !== 'consultoria_vip';
      return true;
    })
    .filter((s) => {
      if (attendanceFilter === 'presencial') return s.attendance_mode === 'presencial';
      if (attendanceFilter === 'online') return s.attendance_mode !== 'presencial';
      return true;
    })
    .filter((s) => {
      if (statusFilter === 'todos') return true;
      return studentStatus(s) === statusFilter;
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

          {attentionItems.length > 0 && (
            <TouchableOpacity style={styles.attentionBanner} onPress={() => setStatusFilter('atencao')}>
              <Ionicons name="warning" size={18} color="#f59e0b" />
              <View style={{ flex: 1 }}>
                <Text style={styles.attentionBannerTitle}>Precisa da Sua Atenção</Text>
                <Text style={styles.attentionBannerSubtitle}>{attentionItems.length} aluno{attentionItems.length !== 1 ? 's' : ''}</Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={18} color="#525252" />
            </TouchableOpacity>
          )}

          <View style={styles.alunosFilterRow}>
            <View style={[styles.studentFilterTabs, { flex: 1, marginBottom: 0 }]}>
              {[
                { value: 'todos', label: 'Todos' },
                { value: 'em_dia', label: 'Em Dia' },
                { value: 'atencao', label: 'Atenção' },
                { value: 'atrasado', label: 'Atrasados' },
              ].map((tab) => (
                <TouchableOpacity
                  key={tab.value}
                  style={[styles.studentFilterTab, statusFilter === tab.value && styles.studentFilterTabActive]}
                  onPress={() => setStatusFilter(tab.value)}
                >
                  <Text style={[styles.studentFilterTabText, statusFilter === tab.value && styles.studentFilterTabTextActive]}>{tab.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.moreFiltersButton} onPress={() => setShowMoreFilters(true)}>
              <Ionicons name="options-outline" size={18} color={studentFilter !== 'todos' || attendanceFilter !== 'todos' ? '#FF6B00' : '#a3a3a3'} />
              {(studentFilter !== 'todos' || attendanceFilter !== 'todos') && <View style={styles.moreFiltersDot} />}
            </TouchableOpacity>
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

          <Modal visible={showMoreFilters} transparent animationType="slide" onRequestClose={() => setShowMoreFilters(false)}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalSheet}>
                <Text style={styles.modalTitle}>Filtros</Text>

                <Text style={styles.accessLevelLabel}>Plano</Text>
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

                <Text style={[styles.accessLevelLabel, { marginTop: 14 }]}>Atendimento</Text>
                <View style={styles.studentFilterTabs}>
                  {[
                    { value: 'todos', label: 'Todos' },
                    { value: 'presencial', label: 'Presencial' },
                    { value: 'online', label: 'Consultoria Online' },
                  ].map((tab) => (
                    <TouchableOpacity
                      key={tab.value}
                      style={[styles.studentFilterTab, attendanceFilter === tab.value && styles.studentFilterTabActive]}
                      onPress={() => setAttendanceFilter(tab.value)}
                    >
                      <Text style={[styles.studentFilterTabText, attendanceFilter === tab.value && styles.studentFilterTabTextActive]}>{tab.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowMoreFilters(false)}>
                  <Text style={styles.modalCloseButtonText}>Fechar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {loading ? (
            <ActivityIndicator color="#FF6B00" style={{ marginTop: 20 }} />
          ) : students.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum aluno ainda. Toque em &quot;+ Aluno&quot; na Início pra começar.</Text>
          ) : filteredStudents.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum aluno encontrado.</Text>
          ) : (
            filteredStudents.map((item) => {
              const done = completedToday[item.id];
              const daysSince = daysSinceLastTrained[item.id];
              const status = studentStatus(item);
              let alertLabel = null;
              if (status === 'atrasado') {
                alertLabel = 'Pagamento atrasado';
              } else if (status === 'atencao') {
                if (!done && (daysSince === null || daysSince >= 3)) alertLabel = daysSince === null ? 'Nunca treinou' : `${daysSince}d sem treinar`;
                else if (unreadMessageStudents[item.id]) alertLabel = 'Mensagem não respondida';
                else if (staleWorkoutStudents[item.id] != null) alertLabel = `Treino há ${staleWorkoutStudents[item.id]}sem sem atualizar`;
                else if (cycleCompletedStudents[item.id] != null) alertLabel = `Ciclo de ${cycleCompletedStudents[item.id]}sem concluído`;
                else if (assessmentOverdueStudents[item.id] != null) alertLabel = `Avaliação física há ${assessmentOverdueStudents[item.id]}sem`;
                else alertLabel = 'Anamnese pendente';
              }
              const isVip = item.access_level === 'consultoria_vip';
              const lastTrainedLabel = lastTrainedDate[item.id]
                ? new Date(lastTrainedDate[item.id]).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                : null;
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
                    <Text style={styles.studentPlanLine}>
                      {isVip ? 'Consultoria VIP' : 'Acesso App'} • {item.attendance_mode === 'presencial' ? 'Presencial' : 'Online'}
                    </Text>
                    {alertLabel ? (
                      <View style={[styles.alertTag, { marginTop: 6 }, status === 'atencao' && styles.attentionTagPending]}>
                        <Ionicons name="alert-circle" size={11} color={status === 'atrasado' ? '#ef4444' : '#f59e0b'} />
                        <Text style={[styles.alertTagText, status === 'atencao' && styles.attentionTagPendingText]}>{alertLabel}</Text>
                      </View>
                    ) : (
                      <Text style={styles.studentLastTrained}>{lastTrainedLabel ? `Último treino: ${lastTrainedLabel}` : 'Ainda não treinou'}</Text>
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

          <View style={styles.nutricaoScopeTabs}>
            {[
              { value: 'planos', label: 'Planos', icon: 'clipboard-outline' },
              { value: 'modelos', label: 'Modelos', icon: 'albums-outline' },
              { value: 'receitas', label: 'Receitas', icon: 'book-outline' },
              { value: 'produtos', label: 'Produtos', icon: 'bag-handle-outline' },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.value}
                style={[styles.nutricaoScopeTab, nutricaoScope === tab.value && styles.nutricaoScopeTabActive]}
                onPress={() => setNutricaoScope(tab.value)}
              >
                <Ionicons name={tab.icon} size={13} color={nutricaoScope === tab.value ? '#0F0F12' : '#a3a3a3'} />
                <Text style={[styles.nutricaoScopeTabText, nutricaoScope === tab.value && styles.nutricaoScopeTabTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {nutricaoScope === 'planos' && (
            <>
              <TouchableOpacity style={styles.aiShortcutCard} onPress={() => setShowStudentPicker(true)}>
                <Ionicons name="sparkles" size={20} color="#FF6B00" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.aiShortcutTitle}>Gerar Dieta com IA</Text>
                  <Text style={styles.aiShortcutSubtitle}>Escolha um aluno e monte um plano alimentar automaticamente</Text>
                </View>
                <Ionicons name="chevron-forward-outline" size={18} color="#525252" />
              </TouchableOpacity>

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
            </>
          )}

          {nutricaoScope === 'modelos' && (
            <TouchableOpacity style={styles.aiShortcutCard} onPress={() => setShowDietTemplates(true)}>
              <Ionicons name="albums-outline" size={20} color="#FF6B00" />
              <View style={{ flex: 1 }}>
                <Text style={styles.aiShortcutTitle}>Modelos de Dieta</Text>
                <Text style={styles.aiShortcutSubtitle}>Crie planos alimentares reutilizáveis e aplique rápido em qualquer aluno</Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={18} color="#525252" />
            </TouchableOpacity>
          )}

          {nutricaoScope === 'receitas' && (
            <View style={styles.shortcutGrid}>
              <TouchableOpacity style={styles.shortcutCard} onPress={() => setShowFoodCatalog(true)}>
                <View style={styles.shortcutIconCircle}>
                  <Ionicons name="nutrition-outline" size={20} color="#FF6B00" />
                </View>
                <Text style={styles.shortcutText}>Catálogo de Alimentos</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.shortcutCard} onPress={() => setShowRecipeManager(true)}>
                <View style={styles.shortcutIconCircle}>
                  <Ionicons name="book-outline" size={20} color="#FF6B00" />
                </View>
                <Text style={styles.shortcutText}>Receitas e E-books</Text>
              </TouchableOpacity>
            </View>
          )}

          {nutricaoScope === 'produtos' && (
            <TouchableOpacity style={styles.aiShortcutCard} onPress={() => setShowProductsManager(true)}>
              <Ionicons name="bag-handle-outline" size={20} color="#FF6B00" />
              <View style={{ flex: 1 }}>
                <Text style={styles.aiShortcutTitle}>Produtos Adicionais</Text>
                <Text style={styles.aiShortcutSubtitle}>E-books, guias e outros produtos de nutrição à venda</Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={18} color="#525252" />
            </TouchableOpacity>
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
        <TouchableOpacity style={[styles.shortcutCard, { width: '100%' }]} onPress={() => setShowProductsManager(true)}>
          <View style={styles.shortcutIconCircle}>
            <Ionicons name="bag-handle-outline" size={20} color="#FF6B00" />
          </View>
          <Text style={styles.shortcutText}>Produtos Adicionais</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.shortcutCard, { width: '100%' }]} onPress={() => setShowProjectBuilder(true)}>
          <View style={styles.shortcutIconCircle}>
            <Ionicons name="rocket-outline" size={20} color="#FF6B00" />
          </View>
          <Text style={styles.shortcutText}>Projetos</Text>
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

      {students.length > 0 && (
        <View style={styles.overviewRow}>
          <View style={styles.overviewItem}>
            <Text style={styles.overviewValue}>{students.length - attentionItems.length}</Text>
            <Text style={styles.overviewLabel}>Em Dia</Text>
          </View>
          <View style={styles.overviewDivider} />
          <View style={styles.overviewItem}>
            <Text style={[styles.overviewValue, attentionItems.length > 0 && styles.overviewValueAlert]}>{attentionItems.length}</Text>
            <Text style={styles.overviewLabel}>Precisam de Atenção</Text>
          </View>
        </View>
      )}

      {attentionItems.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Quem Precisa da Sua Atenção</Text>
          {attentionItems.map(({ student: s, flags }) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.alertRow, !flags.some((f) => f.tone === 'urgent') && styles.attentionRowMuted]}
              onPress={() => setDetailFor(s)}
            >
              <View style={styles.checkinAvatarCircle}>
                {s.avatar_url ? (
                  <Image source={{ uri: s.avatar_url }} style={styles.checkinAvatarImage} />
                ) : (
                  <Text style={styles.checkinAvatarLetter}>{s.name?.charAt(0).toUpperCase() || '?'}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.checkinName}>{s.name}</Text>
                <View style={styles.attentionTagRow}>
                  {flags.map((f) => (
                    <View key={f.key} style={[styles.alertTag, { marginTop: 0 }, f.tone === 'pending' && styles.attentionTagPending]}>
                      <Ionicons name={f.tone === 'urgent' ? 'alert-circle' : 'time-outline'} size={12} color={f.tone === 'urgent' ? '#ef4444' : '#f59e0b'} />
                      <Text style={[styles.alertTagText, f.tone === 'pending' && styles.attentionTagPendingText]}>{f.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </>
      )}

      {students.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Check-ins de Hoje</Text>
          {students.filter((s) => completedToday[s.id]).length === 0 ? (
            <Text style={styles.emptyText}>Nenhum aluno treinou ainda hoje.</Text>
          ) : (
            students.filter((s) => completedToday[s.id]).map((s) => (
              <TouchableOpacity key={s.id} style={styles.checkinRow} onPress={() => setDetailFor(s)}>
                <View style={styles.checkinAvatarCircle}>
                  {s.avatar_url ? (
                    <Image source={{ uri: s.avatar_url }} style={styles.checkinAvatarImage} />
                  ) : (
                    <Text style={styles.checkinAvatarLetter}>{s.name?.charAt(0).toUpperCase() || '?'}</Text>
                  )}
                </View>
                <Text style={styles.checkinName}>{s.name}</Text>
                <View style={styles.checkinDoneTag}>
                  <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
                  <Text style={styles.checkinDoneTagText}>Treinou hoje</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </>
      )}

      <TouchableOpacity style={styles.viewStudentsRow} onPress={() => setActiveTab('alunos')}>
        <Ionicons name="people-outline" size={18} color="#FF6B00" />
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
  container: { flex: 1, backgroundColor: '#0F0F12', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 24 },
  inviteButton: { backgroundColor: 'rgba(255,107,0,0.12)', borderWidth: 1, borderColor: '#FF6B00', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  inviteButtonText: { color: '#FF6B00', fontSize: 12, fontWeight: '600' },
  summaryCard: { flexDirection: 'row', backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 12, paddingVertical: 14, marginBottom: 12 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, backgroundColor: '#2B2B36' },
  summaryValue: { color: '#F5F5F7', fontSize: 16, fontWeight: '800' },
  summaryLabel: { color: '#737373', fontSize: 9, marginTop: 4, textAlign: 'center' },
  overviewRow: { flexDirection: 'row', backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 12, paddingVertical: 14, marginTop: 8, marginBottom: 8 },
  overviewItem: { flex: 1, alignItems: 'center' },
  overviewDivider: { width: 1, backgroundColor: '#2B2B36' },
  overviewValue: { color: '#22c55e', fontSize: 18, fontWeight: '800' },
  overviewValueAlert: { color: '#f59e0b' },
  overviewLabel: { color: '#737373', fontSize: 10, marginTop: 4, textAlign: 'center', fontWeight: '600' },
  shortcutGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  shortcutCard: { width: '47%', backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 14, paddingVertical: 16, alignItems: 'center', gap: 8 },
  shortcutIconCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,107,0,0.12)', alignItems: 'center', justifyContent: 'center' },
  shortcutText: { color: '#F5F5F7', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  bannerRow: { flexDirection: 'row', marginBottom: 10 },
  agendaBanner: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#a855f7', borderRadius: 12, padding: 14 },
  agendaBannerTitle: { color: '#a855f7', fontSize: 13, fontWeight: '700', marginTop: 4 },
  agendaBannerSubtitle: { color: '#a3a3a3', fontSize: 11, marginTop: 2 },
  chatBanner: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#22c55e', borderRadius: 12, padding: 14 },
  chatBannerTitle: { color: '#22c55e', fontSize: 13, fontWeight: '700', marginTop: 4 },
  chatBannerSubtitle: { color: '#a3a3a3', fontSize: 11, marginTop: 2 },
  sectionTitle: { color: '#F5F5F7', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  sectionTitleSpaced: { marginTop: 20 },
  emptyText: { color: '#737373', fontSize: 13, textAlign: 'center', marginTop: 12 },
  checkinRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 12, padding: 12, marginBottom: 8 },
  checkinAvatarCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#2B2B36', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  checkinAvatarImage: { width: 36, height: 36 },
  checkinAvatarLetter: { color: '#FF6B00', fontSize: 13, fontWeight: '800' },
  checkinName: { flex: 1, color: '#F5F5F7', fontSize: 13, fontWeight: '600' },
  checkinDoneTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  checkinDoneTagText: { color: '#22c55e', fontSize: 10, fontWeight: '700' },
  viewStudentsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 14, padding: 14, marginTop: 4 },
  viewStudentsTitle: { color: '#F5F5F7', fontSize: 14, fontWeight: '700' },
  viewStudentsSubtitle: { color: '#a3a3a3', fontSize: 11, marginTop: 2 },
  nutricaoScopeTabs: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  nutricaoScopeTab: { flex: 1, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 10, paddingVertical: 10 },
  nutricaoScopeTabActive: { backgroundColor: '#FF6B00', borderColor: '#FF6B00' },
  nutricaoScopeTabText: { color: '#a3a3a3', fontSize: 11, fontWeight: '700' },
  nutricaoScopeTabTextActive: { color: '#0F0F12' },
  aiShortcutCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,107,0,0.1)', borderWidth: 1, borderColor: '#FF6B00', borderRadius: 14, padding: 16, marginBottom: 8 },
  aiShortcutTitle: { color: '#F5F5F7', fontSize: 14, fontWeight: '700' },
  aiShortcutSubtitle: { color: '#a3a3a3', fontSize: 11, marginTop: 2 },
  recentDietCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 12, padding: 14, marginBottom: 10 },
  recentDietName: { color: '#F5F5F7', fontSize: 13, fontWeight: '700' },
  recentDietStudent: { color: '#737373', fontSize: 11, marginTop: 2 },
  recentDietActiveBadge: { backgroundColor: 'rgba(34,197,94,0.12)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  recentDietActiveBadgeText: { color: '#22c55e', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  studentPickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2B2B36' },
  studentPickerName: { color: '#F5F5F7', fontSize: 14, fontWeight: '600' },
  attentionBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 1, borderColor: '#f59e0b', borderRadius: 12, padding: 14, marginBottom: 12 },
  attentionBannerTitle: { color: '#F5F5F7', fontSize: 13, fontWeight: '700' },
  attentionBannerSubtitle: { color: '#f59e0b', fontSize: 11, fontWeight: '700', marginTop: 2 },
  alunosFilterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  moreFiltersButton: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#1C1C22', alignItems: 'center', justifyContent: 'center' },
  moreFiltersDot: { position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: 4, backgroundColor: '#FF6B00' },
  studentFilterTabs: { flexDirection: 'row', backgroundColor: '#1C1C22', borderRadius: 10, padding: 3, marginBottom: 10, gap: 4 },
  studentFilterTab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 8 },
  studentFilterTabActive: { backgroundColor: '#FF6B00' },
  studentFilterTabText: { color: '#a3a3a3', fontSize: 11, fontWeight: '600', textAlign: 'center' },
  studentFilterTabTextActive: { color: '#0F0F12' },
  studentSearchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14 },
  studentSearchInput: { flex: 1, color: '#F5F5F7', fontSize: 13 },
  studentCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 14, padding: 14, marginBottom: 10 },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#2B2B36', alignItems: 'center', justifyContent: 'center', marginRight: 12, overflow: 'hidden' },
  avatarImage: { width: 44, height: 44 },
  avatarLetter: { color: '#FF6B00', fontSize: 17, fontWeight: '800' },
  studentName: { color: '#F5F5F7', fontSize: 15, fontWeight: '600' },
  studentPlanLine: { color: '#a3a3a3', fontSize: 11, fontWeight: '600', marginTop: 2 },
  studentLastTrained: { color: '#525252', fontSize: 10, marginTop: 6 },
  alertTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, marginTop: 4 },
  alertTagText: { color: '#ef4444', fontSize: 9, fontWeight: '700' },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1C1C22', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: 12, padding: 12, marginBottom: 8 },
  attentionRowMuted: { borderColor: '#2B2B36' },
  attentionTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  attentionTagPending: { backgroundColor: 'rgba(245,158,11,0.12)' },
  attentionTagPendingText: { color: '#f59e0b' },
  chevron: { color: '#525252', fontSize: 22, fontWeight: '300' },
  button: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 20 },
  buttonText: { color: '#FF6B00', fontSize: 15, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#1C1C22', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { color: '#F5F5F7', fontSize: 18, fontWeight: '800', marginBottom: 6 },
  modalSubtitle: { color: '#a3a3a3', fontSize: 12, marginBottom: 16 },
  accessLevelLabel: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 8, fontWeight: '700' },
  modalCodeBox: { backgroundColor: '#0F0F12', borderRadius: 10, padding: 14, marginBottom: 16 },
  modalCodeText: { color: '#FF6B00', fontSize: 11, fontFamily: 'Courier' },
  modalButton: { backgroundColor: '#0F0F12', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  modalButtonDone: { backgroundColor: 'rgba(34,197,94,0.15)' },
  modalButtonText: { color: '#FF6B00', fontSize: 13, fontWeight: '700' },
  modalCloseButton: { paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  modalCloseButtonText: { color: '#a3a3a3', fontSize: 13, fontWeight: '600' },
});
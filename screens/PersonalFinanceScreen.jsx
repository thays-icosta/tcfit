import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, Alert, ActivityIndicator, Modal, Linking, Switch } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Platform } from 'react-native';
import { supabase } from './supabaseClient';

const CATEGORIES = [
  { value: 'treino', label: 'Treino', color: '#f97316' },
  { value: 'dieta', label: 'Dieta', color: '#22c55e' },
  { value: 'consultoria', label: 'Consultoria', color: '#a855f7' },
  { value: 'receita', label: 'Receitas', color: '#3b82f6' },
  { value: 'desafio', label: 'Desafio', color: '#ec4899' },
  { value: 'outro', label: 'Outro', color: '#737373' },
];

function addMonths(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

export default function PersonalFinanceScreen({ personalId, onClose, filterStudentId, filterStudentName }) {
  const [payments, setPayments] = useState([]);
  const [students, setStudents] = useState([]);
  const [myPaymentInfo, setMyPaymentInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pendentes');
  const [showBreakdown, setShowBreakdown] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('outro');
  const [isRecurring, setIsRecurring] = useState(false);
  const [saving, setSaving] = useState(false);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const loadData = async () => {
    let query = supabase
      .from('payments')
      .select('id, amount, due_date, paid, paid_at, description, is_recurring, category, student_id, users!payments_student_id_fkey (name, avatar_url, phone)')
      .eq('personal_id', personalId)
      .order('due_date', { ascending: true });

    if (filterStudentId) query = query.eq('student_id', filterStudentId);

    const { data: paymentRows } = await query;
    setPayments(paymentRows || []);

    const { data: studentRows } = await supabase
      .from('users')
      .select('id, name')
      .eq('personal_id', personalId)
      .eq('role', 'aluno');
    setStudents(studentRows || []);

    const { data: myRow } = await supabase
      .from('users')
      .select('pix_key, payment_link')
      .eq('id', personalId)
      .single();
    if (myRow) setMyPaymentInfo({ pixKey: myRow.pix_key, paymentLink: myRow.payment_link });

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [filterStudentId]);

  const handleOpenAddModal = () => {
    setSelectedStudent(filterStudentId ? { id: filterStudentId, name: filterStudentName } : null);
    setAmount('');
    setDueDate(new Date());
    setDescription('');
    setCategory('outro');
    setIsRecurring(false);
    setShowAddModal(true);
  };

  const handleConfirmAdd = async () => {
    if (!selectedStudent) {
      Alert.alert('Ops', 'Escolhe o aluno primeiro.');
      return;
    }
    if (!amount || isNaN(Number(amount))) {
      Alert.alert('Ops', 'Digita um valor válido.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('payments').insert({
      personal_id: personalId,
      student_id: selectedStudent.id,
      amount: Number(amount),
      due_date: dueDate.toISOString().slice(0, 10),
      description: description.trim() || null,
      category,
      is_recurring: isRecurring,
    });
    setSaving(false);
    if (error) {
      Alert.alert('Erro', error.message);
    } else {
      setShowAddModal(false);
      loadData();
    }
  };

  const handleMarkPaid = async (payment) => {
    const { error } = await supabase
      .from('payments')
      .update({ paid: true, paid_at: new Date().toISOString() })
      .eq('id', payment.id);
    if (error) {
      Alert.alert('Erro', error.message);
      return;
    }
    if (payment.is_recurring) {
      await supabase.from('payments').insert({
        personal_id: personalId,
        student_id: payment.student_id,
        amount: payment.amount,
        due_date: addMonths(payment.due_date, 1),
        description: payment.description,
        category: payment.category,
        is_recurring: true,
      });
    }
    loadData();
  };

  const handleDelete = (paymentId) => {
    Alert.alert('Excluir cobrança', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('payments').delete().eq('id', paymentId);
          loadData();
        },
      },
    ]);
  };

  const handleWhatsAppCharge = (payment) => {
    const phone = payment.users?.phone;
    if (!phone) {
      Alert.alert('Sem telefone cadastrado', 'Esse aluno ainda não tem um número de WhatsApp salvo no perfil dele.');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    let message = `Olá, ${payment.users?.name}! Passando pra lembrar que sua mensalidade${payment.description ? ` (${payment.description})` : ''} de R$ ${Number(payment.amount).toFixed(2)} venceu em ${formatDate(payment.due_date)}. Qualquer dúvida, me chama por aqui 🙂`;

    const paymentParts = [];
    if (myPaymentInfo?.pixKey) paymentParts.push(`Pix: ${myPaymentInfo.pixKey}`);
    if (myPaymentInfo?.paymentLink) paymentParts.push(`Link: ${myPaymentInfo.paymentLink}`);
    if (paymentParts.length > 0) message += `\n\n💳 ${paymentParts.join(' · ')}`;

    Linking.openURL(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`);
  };

  const today = new Date().toISOString().slice(0, 10);
  const totalPending = payments.filter((p) => !p.paid).reduce((sum, p) => sum + Number(p.amount), 0);
  const totalReceivedThisMonth = payments
    .filter((p) => p.paid && p.paid_at && p.paid_at.slice(0, 7) === today.slice(0, 7))
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const overdueCount = payments.filter((p) => !p.paid && p.due_date < today).length;

  const revenueByCategory = CATEGORIES.map((c) => ({
    ...c,
    total: payments.filter((p) => p.paid && (p.category || 'outro') === c.value).reduce((sum, p) => sum + Number(p.amount), 0),
  })).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);
  const totalAllRevenue = revenueByCategory.reduce((sum, c) => sum + c.total, 0);

  let displayList = payments;
  if (filter === 'pendentes') displayList = payments.filter((p) => !p.paid);
  else if (filter === 'pagos') displayList = payments.filter((p) => p.paid);
  else if (filter === 'atrasados') displayList = payments.filter((p) => !p.paid && p.due_date < today);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{filterStudentId ? `Financeiro · ${filterStudentName}` : 'Financeiro'}</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#f97316" style={{ marginTop: 20 }} />
      ) : (
        <>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>R$ {totalReceivedThisMonth.toFixed(0)}</Text>
              <Text style={styles.statLabel}>recebido no mês</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: '#ef4444' }]}>R$ {totalPending.toFixed(0)}</Text>
              <Text style={styles.statLabel}>a receber</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: overdueCount > 0 ? '#ef4444' : '#22c55e' }]}>{overdueCount}</Text>
              <Text style={styles.statLabel}>atrasados</Text>
            </View>
          </View>

          {!filterStudentId && revenueByCategory.length > 0 && (
            <TouchableOpacity style={styles.breakdownCard} onPress={() => setShowBreakdown(!showBreakdown)}>
              <View style={styles.breakdownHeader}>
                <Text style={styles.breakdownTitle}>De onde veio o dinheiro (total pago)</Text>
                <Text style={styles.breakdownTotal}>R$ {totalAllRevenue.toFixed(0)}</Text>
              </View>
              {showBreakdown && revenueByCategory.map((c) => (
                <View key={c.value} style={styles.breakdownRow}>
                  <View style={styles.breakdownLabelRow}>
                    <View style={[styles.breakdownDot, { backgroundColor: c.color }]} />
                    <Text style={styles.breakdownLabel}>{c.label}</Text>
                  </View>
                  <View style={styles.breakdownBarTrack}>
                    <View style={[styles.breakdownBarFill, { width: `${(c.total / totalAllRevenue) * 100}%`, backgroundColor: c.color }]} />
                  </View>
                  <Text style={styles.breakdownValue}>R$ {c.total.toFixed(0)}</Text>
                </View>
              ))}
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.addButton} onPress={handleOpenAddModal}>
            <Text style={styles.addButtonText}>+ Nova Cobrança</Text>
          </TouchableOpacity>

          <View style={styles.filterRow}>
            {[
              { key: 'pendentes', label: 'Pendentes' },
              { key: 'atrasados', label: 'Atrasados' },
              { key: 'pagos', label: 'Pagos' },
              { key: 'todos', label: 'Todos' },
            ].map((f) => (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
                onPress={() => setFilter(f.key)}
              >
                <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView>
            {displayList.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma cobrança nessa categoria.</Text>
            ) : (
              displayList.map((p) => {
                const isOverdue = !p.paid && p.due_date < today;
                const catMeta = CATEGORIES.find((c) => c.value === (p.category || 'outro'));
                return (
                  <View key={p.id} style={styles.card}>
                    <View style={styles.cardHeaderRow}>
                      <Text style={styles.studentName}>{p.users?.name}{p.is_recurring ? ' 🔁' : ''}</Text>
                      <Text style={styles.amountText}>R$ {Number(p.amount).toFixed(2)}</Text>
                    </View>
                    <View style={styles.cardMetaRow}>
                      <Text style={[styles.dueDateText, isOverdue && styles.dueDateOverdue]}>
                        {p.paid ? `Pago em ${p.paid_at ? formatDate(p.paid_at.slice(0, 10)) : ''}` : `Vence em ${formatDate(p.due_date)}`}
                      </Text>
                      <View style={[styles.categoryTag, { borderColor: catMeta?.color }]}>
                        <Text style={[styles.categoryTagText, { color: catMeta?.color }]}>{catMeta?.label}</Text>
                      </View>
                      {isOverdue && <Text style={styles.overdueTag}>ATRASADO</Text>}
                      {p.paid && <Text style={styles.paidTag}>PAGO</Text>}
                    </View>
                    {p.description ? <Text style={styles.descriptionText}>{p.description}</Text> : null}
                    {!p.paid && (
                      <View style={styles.actionRow}>
                        <TouchableOpacity style={styles.markPaidButton} onPress={() => handleMarkPaid(p)}>
                          <Text style={styles.markPaidButtonText}>✓ Marcar como pago</Text>
                        </TouchableOpacity>
                        {isOverdue && (
                          <TouchableOpacity style={styles.whatsappButton} onPress={() => handleWhatsAppCharge(p)}>
                            <Text style={styles.whatsappButtonText}>Cobrar</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={() => handleDelete(p.id)}>
                          <Text style={styles.deleteText}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
        </>
      )}

      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <ScrollView>
              <Text style={styles.modalTitle}>Nova Cobrança</Text>

              {!filterStudentId && (
                <>
                  <Text style={styles.modalLabel}>Aluno</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    {students.map((s) => (
                      <TouchableOpacity
                        key={s.id}
                        style={[styles.studentChip, selectedStudent?.id === s.id && styles.studentChipActive]}
                        onPress={() => setSelectedStudent(s)}
                      >
                        <Text style={[styles.studentChipText, selectedStudent?.id === s.id && styles.studentChipTextActive]}>{s.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              <Text style={styles.modalLabel}>Valor (R$)</Text>
              <TextInput style={styles.modalInput} keyboardType="decimal-pad" placeholder="150" placeholderTextColor="#525252" value={amount} onChangeText={setAmount} />

              <Text style={styles.modalLabel}>Categoria (de onde vem esse dinheiro)</Text>
              <View style={styles.categoryPickerRow}>
                {CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c.value}
                    style={[styles.categoryPickerChip, category === c.value && { backgroundColor: c.color, borderColor: c.color }]}
                    onPress={() => setCategory(c.value)}
                  >
                    <Text style={[styles.categoryPickerChipText, category === c.value && styles.categoryPickerChipTextActive]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalLabel}>Vencimento</Text>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.dateButtonText}>{dueDate.toLocaleDateString('pt-BR')}</Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={dueDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onChange={(event, date) => {
                    setShowDatePicker(Platform.OS === 'ios');
                    if (date) setDueDate(date);
                  }}
                />
              )}

              <Text style={styles.modalLabel}>Descrição (opcional)</Text>
              <TextInput style={styles.modalInput} placeholder="ex: Mensalidade de agosto" placeholderTextColor="#525252" value={description} onChangeText={setDescription} />

              <View style={styles.recurringRow}>
                <Text style={styles.recurringLabel}>Repetir mensalmente</Text>
                <Switch value={isRecurring} onValueChange={setIsRecurring} trackColor={{ false: '#292524', true: '#f97316' }} thumbColor="#f5f5f5" />
              </View>
              {isRecurring && (
                <Text style={styles.recurringHint}>Toda vez que você marcar como pago, uma nova cobrança do mês seguinte é criada automaticamente.</Text>
              )}

              <View style={styles.modalButtonRow}>
                <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowAddModal(false)}>
                  <Text style={styles.modalCancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirmButton} onPress={handleConfirmAdd} disabled={saving}>
                  {saving ? <ActivityIndicator color="#0a0a0a" size="small" /> : <Text style={styles.modalConfirmButtonText}>Adicionar</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50, paddingHorizontal: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  closeText: { color: '#f97316', fontSize: 14, fontWeight: '600' },
  title: { color: '#f5f5f5', fontSize: 16, fontWeight: '700', marginLeft: 16 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statBox: { flex: 1, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  statValue: { color: '#22c55e', fontSize: 15, fontWeight: '800' },
  statLabel: { color: '#a3a3a3', fontSize: 9, marginTop: 4, textAlign: 'center' },
  breakdownCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 14, marginBottom: 14 },
  breakdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  breakdownTitle: { color: '#f5f5f5', fontSize: 12, fontWeight: '700' },
  breakdownTotal: { color: '#22c55e', fontSize: 14, fontWeight: '800' },
  breakdownRow: { marginBottom: 10 },
  breakdownLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  breakdownDot: { width: 8, height: 8, borderRadius: 4 },
  breakdownLabel: { color: '#a3a3a3', fontSize: 11, fontWeight: '600' },
  breakdownBarTrack: { height: 8, backgroundColor: '#0a0a0a', borderRadius: 4, overflow: 'hidden', marginBottom: 4 },
  breakdownBarFill: { height: '100%', borderRadius: 4 },
  breakdownValue: { color: '#f5f5f5', fontSize: 10, fontWeight: '700' },
  addButton: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 14 },
  addButtonText: { color: '#0a0a0a', fontSize: 14, fontWeight: '700' },
  filterRow: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  filterChip: { flex: 1, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  filterChipActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  filterChipText: { color: '#a3a3a3', fontSize: 10, fontWeight: '700' },
  filterChipTextActive: { color: '#0a0a0a' },
  emptyText: { color: '#525252', fontSize: 13, textAlign: 'center', marginTop: 20 },
  card: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 14, marginBottom: 10 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  studentName: { color: '#f5f5f5', fontSize: 14, fontWeight: '700' },
  amountText: { color: '#22c55e', fontSize: 16, fontWeight: '800' },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  dueDateText: { color: '#a3a3a3', fontSize: 11 },
  dueDateOverdue: { color: '#ef4444' },
  categoryTag: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  categoryTagText: { fontSize: 9, fontWeight: '700' },
  overdueTag: { color: '#ef4444', fontSize: 9, fontWeight: '800', backgroundColor: 'rgba(239,68,68,0.12)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  paidTag: { color: '#22c55e', fontSize: 9, fontWeight: '800', backgroundColor: 'rgba(34,197,94,0.12)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  descriptionText: { color: '#737373', fontSize: 11, marginTop: 6, fontStyle: 'italic' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#0a0a0a' },
  markPaidButton: { backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1, borderColor: '#22c55e', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  markPaidButtonText: { color: '#22c55e', fontSize: 10, fontWeight: '700' },
  whatsappButton: { backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1, borderColor: '#22c55e', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  whatsappButtonText: { color: '#22c55e', fontSize: 10, fontWeight: '700' },
  deleteText: { fontSize: 14, marginLeft: 'auto' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#171717', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, maxHeight: '88%' },
  modalTitle: { color: '#f5f5f5', fontSize: 17, fontWeight: '800', marginBottom: 16 },
  modalLabel: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 6, marginTop: 4 },
  studentChip: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 },
  studentChipActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  studentChipText: { color: '#a3a3a3', fontSize: 12, fontWeight: '600' },
  studentChipTextActive: { color: '#0a0a0a' },
  modalInput: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, color: '#f5f5f5', fontSize: 13 },
  categoryPickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryPickerChip: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  categoryPickerChipText: { color: '#a3a3a3', fontSize: 11, fontWeight: '600' },
  categoryPickerChipTextActive: { color: '#0a0a0a' },
  dateButton: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  dateButtonText: { color: '#f5f5f5', fontSize: 14, fontWeight: '600' },
  recurringRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  recurringLabel: { color: '#f5f5f5', fontSize: 13, fontWeight: '600' },
  recurringHint: { color: '#525252', fontSize: 10, marginTop: 6, lineHeight: 14 },
  modalButtonRow: { flexDirection: 'row', gap: 8, marginTop: 20 },
  modalCancelButton: { flex: 1, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalCancelButtonText: { color: '#a3a3a3', fontSize: 13, fontWeight: '600' },
  modalConfirmButton: { flex: 1, backgroundColor: '#f97316', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalConfirmButtonText: { color: '#0a0a0a', fontSize: 13, fontWeight: '700' },
});
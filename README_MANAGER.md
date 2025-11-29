# Creator Stream Talk — Guia do Gestor

Visão simples do produto e como operar o painel admin.

## 1) O que é
- Plataforma de lives pagas por minuto com créditos.
- Papéis:
  - **Usuário**: compra créditos e assiste lives.
  - **Criador**: faz lives e recebe parte dos créditos consumidos.
  - **Admin**: aprova criadores, libera/nega saques e acompanha receita.

## 2) Painel Admin
- **Aprovar criadores**: vá para `/admin/creators`, veja a lista e clique em Aprovar/Revogar. Apenas aprovados podem iniciar lives.
- **Processar saques**: em `/admin/payouts`, veja solicitações pendentes e aprove/rejeite. Aprovar libera pagamento; rejeitar devolve o saldo ao criador.
- **Receita da plataforma**: use as páginas existentes de admin (dashboard/revenue) para conferir métricas e pagamentos.

## 3) Como o dinheiro flui
- Usuário compra créditos.
- Cada período de tempo na live consome créditos.
- Parte vira saldo do criador, parte fica com a plataforma.
- Criador pede saque, admin aprova ou rejeita.
- Afiliados ganham comissão quando trazem novos usuários (cadastro/pagamento de registro).

## 4) Passo a passo rápido
- **Liberar criador para live**: acessar `/admin/creators` → Aprovar.
- **Pagar saque de criador**: ir em `/admin/payouts` → Aprovar; se necessário, marcar como pago no fluxo existente.
- **Ver afiliados funcionando**: peça que um usuário copie o link em Profile (painel de afiliado), crie um novo usuário via link e confira a comissão no painel de afiliados.
- **Testar como usuário**: comprar créditos (checkout Mercado Pago), entrar em live, ver créditos sendo consumidos; ao zerar, o acesso é cortado. Após a live, o criador verá ganhos e poderá pedir saque.

Para detalhes técnicos e variáveis `.env`, consulte o `README_TECHNICAL.md`.

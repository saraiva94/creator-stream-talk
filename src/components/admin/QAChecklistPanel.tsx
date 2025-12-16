import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CheckCircle2, 
  XCircle, 
  MinusCircle, 
  Download, 
  RotateCcw,
  Smartphone,
  Tablet,
  Monitor,
  User,
  UserX,
  Video,
  VideoOff
} from 'lucide-react';

type TestStatus = 'pending' | 'pass' | 'fail' | 'skip';

interface TestCase {
  id: string;
  category: string;
  name: string;
  description: string;
  steps: string[];
  expectedResult: string;
  status: TestStatus;
  notes: string;
  device?: 'mobile' | 'tablet' | 'web' | 'all';
}

const initialTestCases: TestCase[] = [
  // Anonymous Viewer Tests
  {
    id: 'anon-1',
    category: 'Viewer Anônimo',
    name: 'Acesso à live sem login',
    description: 'Verificar se viewer anônimo consegue acessar página de live',
    steps: [
      'Abrir aba anônima',
      'Acessar URL de uma live ativa',
      'Verificar carregamento da página'
    ],
    expectedResult: 'Página carrega sem erros, mostra preview do vídeo',
    status: 'pending',
    notes: '',
    device: 'all'
  },
  {
    id: 'anon-2',
    category: 'Viewer Anônimo',
    name: 'WebRTC conecta e mantém conexão',
    description: 'Viewer anônimo deve manter conexão estável por 2+ minutos',
    steps: [
      'Abrir live em aba anônima',
      'Aguardar conexão WebRTC',
      'Manter página aberta por 2 minutos',
      'Verificar console para erros'
    ],
    expectedResult: 'Sem disconnect/reconnect loop, vídeo estável',
    status: 'pending',
    notes: '',
    device: 'all'
  },
  {
    id: 'anon-3',
    category: 'Viewer Anônimo',
    name: 'Preview 20s + Paywall',
    description: 'Após 20s deve mostrar paywall com botões Login/Register',
    steps: [
      'Abrir live em aba anônima',
      'Aguardar 20 segundos',
      'Verificar overlay de paywall'
    ],
    expectedResult: 'Paywall aparece com botões "Login" e "Register"',
    status: 'pending',
    notes: '',
    device: 'all'
  },
  {
    id: 'anon-4',
    category: 'Viewer Anônimo',
    name: 'Chat read-only',
    description: 'Viewer anônimo pode ler chat mas não enviar',
    steps: [
      'Abrir live em aba anônima',
      'Verificar se mensagens do chat aparecem',
      'Verificar se campo de input está desabilitado'
    ],
    expectedResult: 'Chat visível, input desabilitado com mensagem "Login to chat"',
    status: 'pending',
    notes: '',
    device: 'all'
  },
  
  // Logged Viewer Tests
  {
    id: 'logged-1',
    category: 'Viewer Logado',
    name: 'Acesso à live com login',
    description: 'Viewer logado acessa live normalmente',
    steps: [
      'Fazer login',
      'Acessar live ativa',
      'Verificar carregamento'
    ],
    expectedResult: 'Página carrega, vídeo conecta',
    status: 'pending',
    notes: '',
    device: 'all'
  },
  {
    id: 'logged-2',
    category: 'Viewer Logado',
    name: 'Consumo de créditos após preview',
    description: 'Créditos devem ser consumidos após 20s se tiver saldo',
    steps: [
      'Login com conta que tem créditos',
      'Abrir live',
      'Aguardar 20s',
      'Verificar notificação de consumo'
    ],
    expectedResult: 'Notificação discreta no sino, créditos sendo consumidos',
    status: 'pending',
    notes: '',
    device: 'all'
  },
  {
    id: 'logged-3',
    category: 'Viewer Logado',
    name: 'Chat funcional',
    description: 'Viewer logado pode enviar mensagens no chat',
    steps: [
      'Login',
      'Abrir live',
      'Enviar mensagem no chat',
      'Verificar se aparece'
    ],
    expectedResult: 'Mensagem enviada e exibida no chat',
    status: 'pending',
    notes: '',
    device: 'all'
  },
  {
    id: 'logged-4',
    category: 'Viewer Logado',
    name: 'Paywall sem créditos',
    description: 'Viewer sem créditos vê paywall com "Comprar Créditos"',
    steps: [
      'Login com conta sem créditos',
      'Abrir live',
      'Aguardar 20s'
    ],
    expectedResult: 'Paywall com botão "Buy Credits Now"',
    status: 'pending',
    notes: '',
    device: 'all'
  },

  // Creator Pre-Live Tests
  {
    id: 'creator-pre-1',
    category: 'Criador Pré-Live',
    name: 'Câmera abre automaticamente',
    description: 'Ao entrar na página de transmissão, câmera deve abrir',
    steps: [
      'Login como criador aprovado',
      'Acessar /live-management',
      'Verificar preview da câmera'
    ],
    expectedResult: 'Câmera abre automaticamente mostrando preview',
    status: 'pending',
    notes: '',
    device: 'all'
  },
  {
    id: 'creator-pre-2',
    category: 'Criador Pré-Live',
    name: 'Seleção de dispositivos',
    description: 'Criador pode selecionar câmera/microfone',
    steps: [
      'Na página de transmissão',
      'Abrir seletor de dispositivos',
      'Trocar câmera/microfone'
    ],
    expectedResult: 'Dispositivos listados e selecionáveis',
    status: 'pending',
    notes: '',
    device: 'all'
  },
  {
    id: 'creator-pre-3',
    category: 'Criador Pré-Live',
    name: 'Botão "Ficar Online" visível',
    description: 'Botão de iniciar transmissão deve estar visível',
    steps: [
      'Na página de transmissão',
      'Verificar botão "Ficar Online"'
    ],
    expectedResult: 'Botão visível e clicável',
    status: 'pending',
    notes: '',
    device: 'all'
  },

  // Creator Live Tests
  {
    id: 'creator-live-1',
    category: 'Criador Online',
    name: 'Iniciar transmissão',
    description: 'Clicar em "Ficar Online" inicia live',
    steps: [
      'Clicar "Ficar Online"',
      'Aguardar conexão',
      'Verificar status'
    ],
    expectedResult: 'Live inicia, status muda para "Ao Vivo"',
    status: 'pending',
    notes: '',
    device: 'all'
  },
  {
    id: 'creator-live-2',
    category: 'Criador Online',
    name: 'Apenas 1 card na homepage',
    description: 'Não deve haver duplicação de cards',
    steps: [
      'Iniciar live',
      'Abrir homepage em outra aba',
      'Contar cards do criador'
    ],
    expectedResult: 'Apenas 1 card do criador aparece',
    status: 'pending',
    notes: '',
    device: 'all'
  },
  {
    id: 'creator-live-3',
    category: 'Criador Online',
    name: 'Encerrar transmissão',
    description: 'Botão de encerrar funciona corretamente',
    steps: [
      'Durante live, clicar "Encerrar"',
      'Verificar status',
      'Verificar homepage'
    ],
    expectedResult: 'Live encerra, card some da homepage',
    status: 'pending',
    notes: '',
    device: 'all'
  },
  {
    id: 'creator-live-4',
    category: 'Criador Online',
    name: 'Viewer vê o vídeo do criador',
    description: 'Viewer deve ver o stream do criador',
    steps: [
      'Criador inicia live',
      'Viewer acessa live',
      'Verificar se vídeo aparece'
    ],
    expectedResult: 'Viewer vê vídeo do criador em tempo real',
    status: 'pending',
    notes: '',
    device: 'all'
  },

  // Mobile Tests
  {
    id: 'mobile-1',
    category: 'Mobile/Tablet',
    name: 'Layout fullscreen viewer',
    description: 'Viewer mobile deve ter layout fullscreen',
    steps: [
      'Abrir live em dispositivo mobile',
      'Verificar layout'
    ],
    expectedResult: 'Vídeo fullscreen, chat flutuante',
    status: 'pending',
    notes: '',
    device: 'mobile'
  },
  {
    id: 'mobile-2',
    category: 'Mobile/Tablet',
    name: 'Botão inverter câmera (criador)',
    description: 'Criador mobile deve ter botão de inverter câmera',
    steps: [
      'Abrir /live-management em mobile',
      'Verificar botão de inverter câmera'
    ],
    expectedResult: 'Botão visível e funcional',
    status: 'pending',
    notes: '',
    device: 'mobile'
  },
  {
    id: 'mobile-3',
    category: 'Mobile/Tablet',
    name: 'Chat cascata com fade',
    description: 'Mensagens sobem com fade-out suave',
    steps: [
      'Abrir live em mobile',
      'Observar comportamento do chat'
    ],
    expectedResult: 'Mensagens sobem, fade no topo (~25%)',
    status: 'pending',
    notes: '',
    device: 'mobile'
  },

  // Web Tests
  {
    id: 'web-1',
    category: 'Web Desktop',
    name: 'Layout Twitch-style',
    description: 'Desktop deve ter vídeo à esquerda, chat à direita',
    steps: [
      'Abrir live em desktop',
      'Verificar layout'
    ],
    expectedResult: 'Vídeo esquerda, chat direita, sem distorção',
    status: 'pending',
    notes: '',
    device: 'web'
  },
  {
    id: 'web-2',
    category: 'Web Desktop',
    name: 'Vídeo sem distorção',
    description: 'Vídeo deve manter aspect ratio correto',
    steps: [
      'Abrir live em desktop',
      'Redimensionar janela',
      'Verificar vídeo'
    ],
    expectedResult: 'Vídeo mantém proporção, sem esticar',
    status: 'pending',
    notes: '',
    device: 'web'
  },
  {
    id: 'web-3',
    category: 'Web Desktop',
    name: 'Chat com histórico scroll',
    description: 'Chat desktop deve ter scroll com histórico',
    steps: [
      'Abrir live em desktop',
      'Enviar várias mensagens',
      'Verificar scroll'
    ],
    expectedResult: 'Chat scrollável com histórico completo',
    status: 'pending',
    notes: '',
    device: 'web'
  },

  // Error Handling Tests
  {
    id: 'error-1',
    category: 'Tratamento de Erros',
    name: 'Sem "Uncaught (in promise)"',
    description: 'Console não deve ter promises não tratadas',
    steps: [
      'Navegar pela aplicação',
      'Verificar console',
      'Testar cenários de erro'
    ],
    expectedResult: 'Nenhum "Uncaught (in promise)" no console',
    status: 'pending',
    notes: '',
    device: 'all'
  },
  {
    id: 'error-2',
    category: 'Tratamento de Erros',
    name: 'SuperChat sem quebrar viewer',
    description: 'Erro em SuperChat não deve derrubar viewer',
    steps: [
      'Abrir live',
      'Verificar se superchats carregam',
      'Se erro, viewer deve continuar funcionando'
    ],
    expectedResult: 'Viewer funciona mesmo com erro em superchats',
    status: 'pending',
    notes: '',
    device: 'all'
  },
  {
    id: 'error-3',
    category: 'Tratamento de Erros',
    name: 'Realtime sem loop',
    description: 'Subscriptions não devem ter loop SUBSCRIBED/CLOSED',
    steps: [
      'Abrir homepage',
      'Observar console por 1 minuto'
    ],
    expectedResult: 'Apenas 1 SUBSCRIBED, sem CLOSED repetidos',
    status: 'pending',
    notes: '',
    device: 'all'
  }
];

const statusIcons: Record<TestStatus, React.ReactNode> = {
  pending: <MinusCircle className="h-4 w-4 text-muted-foreground" />,
  pass: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  fail: <XCircle className="h-4 w-4 text-red-500" />,
  skip: <MinusCircle className="h-4 w-4 text-yellow-500" />
};

const statusLabels: Record<TestStatus, string> = {
  pending: 'Pendente',
  pass: 'Passou',
  fail: 'Falhou',
  skip: 'Pulado'
};

const deviceIcons = {
  mobile: <Smartphone className="h-3 w-3" />,
  tablet: <Tablet className="h-3 w-3" />,
  web: <Monitor className="h-3 w-3" />,
  all: null
};

export function QAChecklistPanel() {
  const [testCases, setTestCases] = useState<TestCase[]>(initialTestCases);
  const [expandedTest, setExpandedTest] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | TestStatus>('all');

  const updateTestStatus = useCallback((id: string, status: TestStatus) => {
    setTestCases(prev => prev.map(tc => 
      tc.id === id ? { ...tc, status } : tc
    ));
  }, []);

  const updateTestNotes = useCallback((id: string, notes: string) => {
    setTestCases(prev => prev.map(tc => 
      tc.id === id ? { ...tc, notes } : tc
    ));
  }, []);

  const resetAll = useCallback(() => {
    setTestCases(initialTestCases);
  }, []);

  const generateReport = useCallback(() => {
    const now = new Date().toISOString();
    const passed = testCases.filter(tc => tc.status === 'pass').length;
    const failed = testCases.filter(tc => tc.status === 'fail').length;
    const skipped = testCases.filter(tc => tc.status === 'skip').length;
    const pending = testCases.filter(tc => tc.status === 'pending').length;
    const total = testCases.length;

    const report = `
# QA Report - Stream Star
Generated: ${now}

## Summary
- Total Tests: ${total}
- ✅ Passed: ${passed} (${((passed/total)*100).toFixed(1)}%)
- ❌ Failed: ${failed} (${((failed/total)*100).toFixed(1)}%)
- ⏭️ Skipped: ${skipped}
- ⏳ Pending: ${pending}

## Results by Category

${Object.entries(
  testCases.reduce((acc, tc) => {
    if (!acc[tc.category]) acc[tc.category] = [];
    acc[tc.category].push(tc);
    return acc;
  }, {} as Record<string, TestCase[]>)
).map(([category, tests]) => `
### ${category}
${tests.map(tc => `
- [${tc.status === 'pass' ? '✅' : tc.status === 'fail' ? '❌' : tc.status === 'skip' ? '⏭️' : '⏳'}] **${tc.name}**
  - Status: ${statusLabels[tc.status]}
  ${tc.notes ? `- Notes: ${tc.notes}` : ''}
`).join('')}
`).join('')}

## Failed Tests Details

${testCases.filter(tc => tc.status === 'fail').map(tc => `
### ${tc.name}
- **Category:** ${tc.category}
- **Description:** ${tc.description}
- **Expected:** ${tc.expectedResult}
- **Notes:** ${tc.notes || 'No notes'}
`).join('\n') || 'No failed tests! 🎉'}

---
End of Report
`;

    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qa-report-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [testCases]);

  const filteredTests = filter === 'all' 
    ? testCases 
    : testCases.filter(tc => tc.status === filter);

  const categories = [...new Set(testCases.map(tc => tc.category))];

  const stats = {
    total: testCases.length,
    pass: testCases.filter(tc => tc.status === 'pass').length,
    fail: testCases.filter(tc => tc.status === 'fail').length,
    skip: testCases.filter(tc => tc.status === 'skip').length,
    pending: testCases.filter(tc => tc.status === 'pending').length
  };

  return (
    <Card className="bg-card/50 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            QA Checklist
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetAll}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
            <Button size="sm" onClick={generateReport}>
              <Download className="h-4 w-4 mr-1" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-2 mt-3 flex-wrap">
          <Badge 
            variant={filter === 'all' ? 'default' : 'outline'} 
            className="cursor-pointer"
            onClick={() => setFilter('all')}
          >
            Total: {stats.total}
          </Badge>
          <Badge 
            variant={filter === 'pass' ? 'default' : 'outline'} 
            className="cursor-pointer bg-green-500/20 text-green-400 hover:bg-green-500/30"
            onClick={() => setFilter('pass')}
          >
            ✅ {stats.pass}
          </Badge>
          <Badge 
            variant={filter === 'fail' ? 'default' : 'outline'} 
            className="cursor-pointer bg-red-500/20 text-red-400 hover:bg-red-500/30"
            onClick={() => setFilter('fail')}
          >
            ❌ {stats.fail}
          </Badge>
          <Badge 
            variant={filter === 'skip' ? 'default' : 'outline'} 
            className="cursor-pointer bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
            onClick={() => setFilter('skip')}
          >
            ⏭️ {stats.skip}
          </Badge>
          <Badge 
            variant={filter === 'pending' ? 'default' : 'outline'} 
            className="cursor-pointer"
            onClick={() => setFilter('pending')}
          >
            ⏳ {stats.pending}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          {categories.map(category => {
            const categoryTests = filteredTests.filter(tc => tc.category === category);
            if (categoryTests.length === 0) return null;

            return (
              <div key={category} className="mb-6">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  {category.includes('Anônimo') && <UserX className="h-4 w-4" />}
                  {category.includes('Logado') && <User className="h-4 w-4" />}
                  {category.includes('Pré-Live') && <VideoOff className="h-4 w-4" />}
                  {category.includes('Online') && <Video className="h-4 w-4" />}
                  {category.includes('Mobile') && <Smartphone className="h-4 w-4" />}
                  {category.includes('Web') && <Monitor className="h-4 w-4" />}
                  {category}
                </h3>

                <div className="space-y-2">
                  {categoryTests.map(tc => (
                    <div 
                      key={tc.id} 
                      className="border border-border/50 rounded-lg p-3 hover:border-border transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex items-center gap-2 mt-0.5">
                          {statusIcons[tc.status]}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div 
                            className="flex items-center gap-2 cursor-pointer"
                            onClick={() => setExpandedTest(expandedTest === tc.id ? null : tc.id)}
                          >
                            <span className="font-medium text-sm">{tc.name}</span>
                            {tc.device && tc.device !== 'all' && (
                              <Badge variant="outline" className="text-xs px-1.5 py-0">
                                {deviceIcons[tc.device]}
                              </Badge>
                            )}
                          </div>

                          {expandedTest === tc.id && (
                            <div className="mt-3 space-y-3 text-sm">
                              <p className="text-muted-foreground">{tc.description}</p>
                              
                              <div>
                                <span className="font-medium">Passos:</span>
                                <ol className="list-decimal list-inside ml-2 text-muted-foreground">
                                  {tc.steps.map((step, i) => (
                                    <li key={i}>{step}</li>
                                  ))}
                                </ol>
                              </div>

                              <div>
                                <span className="font-medium">Resultado esperado:</span>
                                <p className="text-muted-foreground ml-2">{tc.expectedResult}</p>
                              </div>

                              <Textarea
                                placeholder="Notas / observações..."
                                value={tc.notes}
                                onChange={(e) => updateTestNotes(tc.id, e.target.value)}
                                className="h-20 text-xs"
                              />
                            </div>
                          )}
                        </div>

                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant={tc.status === 'pass' ? 'default' : 'outline'}
                            className={tc.status === 'pass' ? 'bg-green-500 hover:bg-green-600' : ''}
                            onClick={() => updateTestStatus(tc.id, 'pass')}
                          >
                            ✅
                          </Button>
                          <Button
                            size="sm"
                            variant={tc.status === 'fail' ? 'default' : 'outline'}
                            className={tc.status === 'fail' ? 'bg-red-500 hover:bg-red-600' : ''}
                            onClick={() => updateTestStatus(tc.id, 'fail')}
                          >
                            ❌
                          </Button>
                          <Button
                            size="sm"
                            variant={tc.status === 'skip' ? 'default' : 'outline'}
                            className={tc.status === 'skip' ? 'bg-yellow-500 hover:bg-yellow-600' : ''}
                            onClick={() => updateTestStatus(tc.id, 'skip')}
                          >
                            ⏭️
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

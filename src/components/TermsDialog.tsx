import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Info } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

export const TermsDialog = () => {
  const { t } = useLanguage();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-muted hover:bg-muted/80 transition-colors ml-1"
          aria-label={t.terms?.viewTerms || "Ver termos e condições"}
        >
          <Info className="w-3 h-3 text-muted-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{t.terms?.title || "Termos e Condições de Uso"}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-6 text-sm text-muted-foreground">
            <section>
              <h3 className="text-foreground font-semibold mb-2">1. DEFINIÇÕES</h3>
              <p className="mb-2">Para fins destes Termos de Uso, considera-se:</p>
              <ul className="list-disc pl-4 space-y-2">
                <li><strong>"Plataforma"</strong> – o site, aplicativo e demais serviços online operados por Jhonatan Silvere, sob a marca StreamStar, que permitem a transmissão ao vivo, publicação de conteúdos audiovisuais e interação via chat entre Criadores de Conteúdo e Usuários.</li>
                <li><strong>"Usuário"</strong> – toda pessoa física maior de 18 (dezoito) anos, regularmente cadastrada, que acessa a Plataforma para assistir transmissões, consumir conteúdos, interagir em chats e/ou realizar contribuições financeiras.</li>
                <li><strong>"Criador de Conteúdo"</strong> – Usuário maior de 18 (dezoito) anos que utiliza a Plataforma para transmitir conteúdos ao vivo, publicar vídeos, áudios, imagens e textos, bem como interagir com demais Usuários, podendo receber valores por meio de Créditos, "superchats", gorjetas ou funcionalidades equivalentes.</li>
                <li><strong>"Conteúdo"</strong> – qualquer áudio, vídeo, imagem, texto, transmissão ao vivo, gravação, comentário ou outro material disponibilizado na Plataforma por Criadores de Conteúdo ou Usuários.</li>
                <li><strong>"Créditos"</strong> – unidade virtual de uso interno da Plataforma, adquirida em moeda corrente nacional pelos Usuários, e que pode ser utilizada para acesso a determinadas funcionalidades, envio de superchats, gorjetas ou recursos similares, sem natureza de moeda eletrônica, depósito, investimento ou ativo financeiro.</li>
                <li><strong>"Carteira Virtual"</strong> – ambiente digital associado à conta do Usuário na Plataforma, no qual são visualizados os Créditos adquiridos e o histórico de utilização, sem possibilidade de saques em dinheiro pelo Usuário.</li>
                <li><strong>"Superchat"</strong> – funcionalidade que permite ao Usuário destacar mensagens, contribuições ou interações durante transmissões ao vivo, mediante pagamento em moeda corrente ou uso de Créditos, sem caráter de contraprestação obrigatória específica por parte do Criador de Conteúdo.</li>
              </ul>
            </section>

            <section>
              <h3 className="text-foreground font-semibold mb-2">2. ELEGIBILIDADE E IDADE MÍNIMA</h3>
              <ul className="list-disc pl-4 space-y-2">
                <li>2.1. A utilização da Plataforma é estritamente proibida a menores de 18 (dezoito) anos, seja na condição de Usuário, seja na condição de Criador de Conteúdo.</li>
                <li>2.2. Ao se cadastrar, o Usuário declara, de forma expressa, sob as penas da lei, que:
                  <ul className="list-[lower-alpha] pl-4 mt-1 space-y-1">
                    <li>possui 18 (dezoito) anos completos ou mais;</li>
                    <li>possui plena capacidade civil para celebrar contratos;</li>
                    <li>leu, compreendeu e concorda com estes Termos de Uso e com a Política de Privacidade.</li>
                  </ul>
                </li>
                <li>2.3. StreamStar poderá, a seu exclusivo critério, exigir documentos que comprovem a idade e identidade do Usuário ou Criador de Conteúdo, podendo suspender ou encerrar contas em caso de suspeita de falsidade ou uso indevido por menores de idade.</li>
                <li>2.4. Constatado o uso da Plataforma por menor de idade, a conta poderá ser imediatamente encerrada, sem direito a qualquer tipo de reembolso, ressalvadas as hipóteses previstas em lei.</li>
                <li className="bg-muted/50 p-3 rounded-lg border border-border">
                  <strong className="text-foreground">2.5. RESPONSABILIDADE DOS PAIS E RESPONSÁVEIS LEGAIS:</strong>
                  <p className="mt-2">
                    Conforme o <strong>Código Civil Brasileiro (Lei nº 10.406/2002)</strong>, especialmente os artigos 932 e 1.634, e o <strong>Estatuto da Criança e do Adolescente - ECA (Lei nº 8.069/1990)</strong>, a responsabilidade pelo monitoramento, controle e supervisão do uso de plataformas digitais por menores de idade é <strong>exclusiva dos pais ou responsáveis legais</strong>.
                  </p>
                  <p className="mt-2">
                    Caso um menor de 18 (dezoito) anos, ao se cadastrar na Plataforma, preste informações falsas sobre sua idade, a responsabilidade pelo acesso indevido, bem como por quaisquer danos, prejuízos ou consequências decorrentes do uso da Plataforma por esse menor, recairá <strong>exclusivamente sobre os pais ou responsáveis legais</strong>, que têm o dever legal de vigiar, orientar e acompanhar as atividades online de seus filhos ou tutelados.
                  </p>
                  <p className="mt-2">
                    A Plataforma adota mecanismos de verificação de idade no momento do cadastro, porém não pode ser responsabilizada por declarações falsas prestadas por usuários que afirmem ter idade superior à real. Em tais casos, os pais ou responsáveis legais assumem integralmente os riscos e responsabilidades decorrentes.
                  </p>
                </li>
              </ul>
            </section>

            <section>
              <h3 className="text-foreground font-semibold mb-2">3. SISTEMA DE CRÉDITOS, ADESÕES E SUPERCHAT</h3>
              <ul className="list-disc pl-4 space-y-2">
                <li>3.1. Os Créditos adquiridos pelos Usuários destinam-se exclusivamente ao uso dentro da Plataforma, não possuindo qualquer natureza de moeda eletrônica, ativo financeiro, aplicação, depósito, investimento ou produto financeiro.</li>
                <li>3.2. Os Créditos não são conversíveis em dinheiro, não podem ser sacados pelo Usuário e não geram juros, correção monetária, rendimentos ou qualquer tipo de remuneração.</li>
                <li>3.3. Os valores pagos a título de compra de Créditos, taxas de adesão, ativação, cadastro ou funcionalidades premium, e envio de superchat, gorjetas ou contribuições voluntárias a Criadores de Conteúdo, são, em regra, <strong>definitivos e não reembolsáveis</strong>, salvo nas hipóteses expressamente previstas na legislação aplicável.</li>
                <li>3.4. Por se tratar de <strong>conteúdo digital de fruição imediata e contribuições de natureza voluntária</strong>, o arrependimento imotivado após o uso do serviço ou envio de superchat não gera direito automático a reembolso.</li>
                <li>3.5. Eventuais solicitações de contestação de cobrança ou reembolso serão analisadas individualmente.</li>
                <li>3.6. A exclusão ou encerramento da conta do Usuário não ensejará qualquer tipo de indenização, ressarcimento ou reembolso de Créditos remanescentes.</li>
              </ul>
            </section>

            <section>
              <h3 className="text-foreground font-semibold mb-2">4. CONTEÚDO GERADO POR USUÁRIOS E LIMITAÇÃO DE RESPONSABILIDADE</h3>
              <ul className="list-disc pl-4 space-y-2">
                <li>4.1. A Plataforma funciona como ambiente de hospedagem e intermediação tecnológica para transmissões ao vivo. StreamStar não produz, edita ou aprova previamente os Conteúdos disponibilizados por terceiros.</li>
                <li>4.2. Cada Criador de Conteúdo é <strong>exclusivamente responsável</strong>, civil e criminalmente, pelas transmissões, postagens, falas, opiniões, imagens, músicas, marcas, obras e demais Conteúdos que veicular por meio da Plataforma.</li>
                <li>4.3. Cada Usuário é <strong>exclusivamente responsável</strong> pelos comentários, mensagens, superchats, reações e demais manifestações que fizer na Plataforma.</li>
                <li>4.4. StreamStar não se responsabiliza por opiniões, falas, conselhos, recomendações, informações ou qualquer tipo de manifestação emitida por Criadores de Conteúdo ou Usuários.</li>
                <li>4.5. Em conformidade com o Marco Civil da Internet (Lei nº 12.965/2014), StreamStar somente poderá ser responsabilizada por Conteúdos gerados por terceiros quando, após ordem judicial específica, deixar de promover a indisponibilização do material.</li>
                <li>4.6. StreamStar poderá, a seu exclusivo critério, remover ou restringir acesso a Conteúdos que violem estes Termos de Uso ou a legislação vigente.</li>
                <li>4.7. A remoção ou bloqueio de Conteúdo não gera ao Usuário ou Criador de Conteúdo qualquer direito a indenização, reembolso ou compensação.</li>
              </ul>
            </section>

            <section>
              <h3 className="text-foreground font-semibold mb-2">5. CONDUTA DO USUÁRIO E DO CRIADOR DE CONTEÚDO</h3>
              <ul className="list-disc pl-4 space-y-2">
                <li>5.1. É expressamente proibido utilizar a Plataforma para:
                  <ul className="list-[lower-alpha] pl-4 mt-1 space-y-1">
                    <li>praticar qualquer ato ilícito, incluindo ameaças, perseguição, difamação, calúnia, injúria, estelionato, incitação ao crime;</li>
                    <li>veicular Conteúdos que violem direitos autorais, de imagem, de marca;</li>
                    <li>divulgar ou solicitar dados pessoais sensíveis de terceiros sem base legal;</li>
                    <li>praticar assédio, discurso de ódio ou discriminação;</li>
                    <li>publicar Conteúdos que incentivem automutilação, suicídio, uso abusivo de drogas;</li>
                    <li>praticar spam, golpes, esquemas financeiros enganosos;</li>
                    <li>tentar burlar sistemas de segurança da Plataforma;</li>
                    <li>utilizar bots, scripts automatizados ou outros meios não autorizados.</li>
                  </ul>
                </li>
                <li>5.2. O descumprimento destas regras poderá resultar em advertência, suspensão temporária, bloqueio definitivo da conta, perda de Créditos e outras medidas cabíveis.</li>
              </ul>
            </section>

            <section>
              <h3 className="text-foreground font-semibold mb-2">6. LIMITAÇÃO DE RESPONSABILIDADE</h3>
              <ul className="list-disc pl-4 space-y-2">
                <li>6.1. StreamStar envidará esforços razoáveis para manter a Plataforma disponível, mas não garante disponibilidade ininterrupta.</li>
                <li>6.2. Em nenhuma hipótese StreamStar será responsável por atos, omissões, Conteúdos de terceiros, lucros cessantes, perda de oportunidade ou dados.</li>
                <li>6.3. A responsabilidade total, em qualquer caso, ficará limitada ao montante equivalente a até R$ 100,00 (cem reais) por Usuário afetado, salvo se a legislação aplicável vedar tal limitação.</li>
              </ul>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

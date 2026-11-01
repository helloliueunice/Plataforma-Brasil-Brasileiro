/**
 * Regras do destaque patrocinado — usadas pelo gerador de páginas e pelo relatório ao patrocinador.
 * (A plataforma, no index.html, repete as mesmas regras em patrocinioAtivo() e vagasPatrocinio().)
 *
 * Campos opcionais de cada edital no editais.json:
 *   patrocinado       true para ligar o destaque
 *   patrocinador      nome de quem paga (até 80 caracteres) — aparece no selo "Patrocinado por <nome>"
 *   patrocinioInicio  AAAA-MM-DD (opcional; sem ele, vale desde já)
 *   patrocinioAte     AAAA-MM-DD (opcional; sem ele, vale enquanto a chamada não encerrar)
 *   patrocinioVagas   lista com "inicio", "publico", "area", "semana" (padrão ["inicio"])
 *
 * O patrocínio nunca altera busca, filtros, compatibilidade nem a ordem das listas: só acrescenta o selo
 * e ocupa UMA vaga reservada e sinalizada em cada página escolhida.
 */
export const VAGAS = ['inicio', 'publico', 'area', 'semana'];
export const VAGA_ROTULO = { inicio: 'Página inicial (1ª vaga do destaque)', publico: 'Páginas por público (para/…)', area: 'Páginas por área (area/…)', semana: 'Resumo da semana (semana/)' };
const isoOk = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

export const nomePatrocinador = e => String(e?.patrocinador ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
export const textoSelo = e => (nomePatrocinador(e) ? `Publicidade · Patrocinado por ${nomePatrocinador(e)}` : 'Publicidade · Patrocinado');

export function vagasDe(e) {
    const v = Array.isArray(e?.patrocinioVagas) ? e.patrocinioVagas.filter(x => VAGAS.includes(x)) : [];
    return v.length ? [...new Set(v)] : ['inicio'];
}

/** Situação do patrocínio em um dia: 'ativo', 'agendado', 'expirado' (período acabou) ou 'chamada-encerrada'. null se não é patrocinado. */
export function situacaoPatrocinio(e, hoje) {
    if (!e || !e.patrocinado) return null;
    if (!nomePatrocinador(e)) return 'sem-patrocinador'; // selo exige o nome de quem paga (transparência publicitária)
    if (isoOk(e.patrocinioInicio) && e.patrocinioInicio > hoje) return 'agendado';
    if (isoOk(e.patrocinioAte) && e.patrocinioAte < hoje) return 'expirado';
    if (isoOk(e.encerramento) && e.encerramento < hoje) return 'chamada-encerrada';
    return 'ativo';
}

/** Patrocínio vigente hoje (e, se `vaga` for dada, contratado para essa vaga). */
export const patrocinioAtivo = (e, hoje, vaga) => situacaoPatrocinio(e, hoje) === 'ativo' && (!vaga || vagasDe(e).includes(vaga));

/**
 * Escolhe quem ocupa a vaga única quando há mais de um patrocínio vigente para ela:
 * rodízio diário pela ordem de id (cada um aparece em dias alternados). Determinístico para o mesmo dia.
 */
export function escolherVaga(lista, hoje) {
    if (!lista.length) return null;
    const ord = [...lista].sort((a, b) => Number(a.id) - Number(b.id));
    const dia = Math.floor(Date.parse(`${hoje}T12:00:00Z`) / 864e5);
    return ord[((dia % ord.length) + ord.length) % ord.length];
}

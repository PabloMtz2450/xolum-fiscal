export type FiscalReadinessInput = {
  catalogsLoaded: boolean;
  xsdBundlesLoaded: boolean;
  csdConfigured: boolean;
  originalStringConfigured: boolean;
  pacConfigured: boolean;
  pacHealthcheckOk: boolean;
  pacPreflightAvailable: boolean;
  testsPassing: boolean;
};

export type FiscalReadinessReport = {
  readyForPacSandbox: boolean;
  readyForProduction: boolean;
  blockers: string[];
};

export function evaluateFiscalReadiness(input: FiscalReadinessInput): FiscalReadinessReport {
  const blockers: string[] = [];
  if (!input.catalogsLoaded) blockers.push('Faltan snapshots versionados de catálogos SAT.');
  if (!input.xsdBundlesLoaded) blockers.push('Faltan bundles XSD locales con dependencias.');
  if (!input.csdConfigured) blockers.push('Falta configurar CSD válido para pruebas.');
  if (!input.originalStringConfigured) blockers.push('Falta generador de cadena original/sello integrado al flujo.');
  if (!input.pacConfigured) blockers.push('Falta configurar PAC sandbox y credenciales.');
  if (!input.pacHealthcheckOk) blockers.push('El PAC sandbox no ha pasado healthcheck.');
  if (!input.pacPreflightAvailable) blockers.push('El PAC seleccionado no tiene preflight integrado o equivalente.');
  if (!input.testsPassing) blockers.push('La suite fiscal aún no está confirmada en verde.');

  const readyForPacSandbox = blockers.filter((b) => !b.includes('PAC sandbox') && !b.includes('PAC seleccionado')).length === 0 && input.pacConfigured;
  return {
    readyForPacSandbox,
    readyForProduction: blockers.length === 0,
    blockers,
  };
}

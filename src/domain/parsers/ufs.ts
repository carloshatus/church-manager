export interface UfInfo {
  uf: string;
  name: string;
}

export const UF_MAP: Record<string, UfInfo> = {
  '11': { uf: 'RO', name: 'Rondônia' },
  '12': { uf: 'AC', name: 'Acre' },
  '13': { uf: 'AM', name: 'Amazonas' },
  '14': { uf: 'RR', name: 'Roraima' },
  '15': { uf: 'PA', name: 'Pará' },
  '16': { uf: 'AP', name: 'Amapá' },
  '17': { uf: 'TO', name: 'Tocantins' },
  '21': { uf: 'MA', name: 'Maranhão' },
  '22': { uf: 'PI', name: 'Piauí' },
  '23': { uf: 'CE', name: 'Ceará' },
  '24': { uf: 'RN', name: 'Rio Grande do Norte' },
  '25': { uf: 'PB', name: 'Paraíba' },
  '26': { uf: 'PE', name: 'Pernambuco' },
  '27': { uf: 'AL', name: 'Alagoas' },
  '28': { uf: 'SE', name: 'Sergipe' },
  '29': { uf: 'BA', name: 'Bahia' },
  '31': { uf: 'MG', name: 'Minas Gerais' },
  '32': { uf: 'ES', name: 'Espírito Santo' },
  '33': { uf: 'RJ', name: 'Rio de Janeiro' },
  '35': { uf: 'SP', name: 'São Paulo' },
  '41': { uf: 'PR', name: 'Paraná' },
  '42': { uf: 'SC', name: 'Santa Catarina' },
  '43': { uf: 'RS', name: 'Rio Grande do Sul' },
  '50': { uf: 'MS', name: 'Mato Grosso do Sul' },
  '51': { uf: 'MT', name: 'Mato Grosso' },
  '52': { uf: 'GO', name: 'Goiás' },
  '53': { uf: 'DF', name: 'Distrito Federal' },
};

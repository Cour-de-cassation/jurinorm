import { normalizeCa } from './handler';
import { sendToSder } from '../library/DbSder';
import { computeInteretParticulier } from '../library/metadata/interetParticulier';
import { RaisonInteretParticulier } from 'dbsder-api-types';

jest.mock('../library/DbSder', () => ({
  sendToSder: jest.fn(),
}));
jest.mock('../library/metadata/interetParticulier', () => ({
  computeInteretParticulier: jest.fn(),
}));
jest.mock('../library/DbRawFile', () => ({
  findFileInformations: jest.fn().mockResolvedValue({ toArray: async () => [], next: async () => null }),
}));

describe('normalizeCa – caDecision content', () => {
  const rawCa: any = {
    _id: 'raw1',
    metadatas: {
      selection: true,
      sommaire: 'S4 - ...',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('merges metadatas with interetParticulier when true', async () => {
    (computeInteretParticulier as jest.Mock).mockReturnValue({
      interetParticulier: true,
      raisonInteretParticulier: RaisonInteretParticulier.S4_SUJET_INTERET_PUBLIC_MAJEUR,
    });

    await normalizeCa(rawCa);

    expect(computeInteretParticulier).toHaveBeenCalledWith(true, 'S4 - ...');
    expect(sendToSder).toHaveBeenCalledWith(
      expect.objectContaining({
        interetParticulier: true,
        raisonInteretParticulier: RaisonInteretParticulier.S4_SUJET_INTERET_PUBLIC_MAJEUR,
      })
    );
  });

  it('merges metadatas with interetParticulier when false', async () => {
    (computeInteretParticulier as jest.Mock).mockReturnValue({
      interetParticulier: false,
      raisonInteretParticulier: undefined,
    });

    await normalizeCa(rawCa);

    expect(sendToSder).toHaveBeenCalledWith(
      expect.objectContaining({
        interetParticulier: false,
        raisonInteretParticulier: undefined,
      })
    );
  });
});

import { describe, it, expect, vi } from 'vitest';
import { CheckoutLinksService } from '../services';

const createRepositoryMock = () => ({
  findAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
});

describe('CheckoutLinksService', () => {
  it('findAll should use repository and return records', async () => {
    const repository = createRepositoryMock();
    const expected = [{ id: 'a1', weight: '1' }];
    repository.findAll.mockResolvedValue(expected);

    const service = new CheckoutLinksService(repository as never);
    const result = await service.findAll();

    expect(repository.findAll).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toEqual(expected);
  });

  describe('findAll', () => {
    it('should return repository results', async () => {
      const repository = createRepositoryMock();
      repository.findAll.mockResolvedValue([]);
      const service = new CheckoutLinksService(repository as never);

      const result = await service.findAll();
      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return null', async () => {
      const repository = createRepositoryMock();
      repository.findById.mockResolvedValue(null);
      const service = new CheckoutLinksService(repository as never);

      const result = await service.findById(1);

      expect(repository.findById).toHaveBeenCalledWith('1');
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should normalize nullable fields and delegate to repository', async () => {
      const repository = createRepositoryMock();
      repository.create.mockResolvedValue({ id: 'x1', weight: '10' });
      const service = new CheckoutLinksService(repository as never);

      await service.create({
        weight: '10',
        width: '20',
        length: '30',
        height: '40',
      });

      expect(repository.create).toHaveBeenCalledWith({
        weight: '10',
        width: '20',
        length: '30',
        height: '40',
        checkoutLinks: null,
        productPortals: null,
        productNames: null,
        deletedAt: null,
      });
    });
  });
});

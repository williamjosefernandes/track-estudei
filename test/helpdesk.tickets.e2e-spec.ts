import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HelpDeskService } from '../src/helpdesk/helpdesk.service';
import { PaginationResponse } from '../src/common/pagination/pagination-response.dto';
import { TicketResponseDto } from '../src/helpdesk/dto/ticket-response.dto';
import { UserGuard } from '../src/auth/guard/user.guard';

describe('GET /helpdesk/tickets (e2e)', () => {
  let app: INestApplication;

  const stubItems: TicketResponseDto[] = [
    {
      id: 't1',
      userId: 'u1',
      title: 'Sample',
      description: 'Desc',
      category: 'General',
      priority: 'LOW',
      status: 'open',
      createdAt: new Date('2025-01-15T00:00:00.000Z'),
      updatedAt: new Date('2025-01-16T00:00:00.000Z'),
      resolution: undefined,
      attachments: undefined,
    },
  ];

  const stubPagination = {
    pageNumber: 1,
    pageSize: 50,
    totalItems: 1,
    totalPages: 1,
    previousPage: 0,
    nextPage: 0,
    lastPage: 1,
    hasPreviousPage: false,
    hasNextPage: false,
  };

  const helpdeskStub: Partial<HelpDeskService> = {
    async listTickets() {
      return new PaginationResponse<TicketResponseDto>(stubItems, stubPagination as any);
    },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(HelpDeskService)
      .useValue(helpdeskStub)
      .overrideGuard(UserGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 and paginated items with filters', async () => {
    const res = await request(app.getHttpServer())
      .get('/helpdesk/tickets')
      .query({
        page: 1,
        limit: 50,
        status: 'open',
        category: 'General',
        priority: 'LOW',
        search: 'Sample',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        sortBy: 'updatedAt',
        sortOrder: 'asc',
      })
      .expect(200);

    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBe(1);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.items[0].title).toBe('Sample');
  });
});
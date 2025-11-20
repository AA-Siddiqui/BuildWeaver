import { AppService } from './app.service';

describe('AppService', () => {
  it('provides timestamped status', () => {
    const service = new AppService();
    const payload = service.getHealth();
    expect(payload.status).toBe('ok');
    expect(typeof payload.timestamp).toBe('string');
  });
});

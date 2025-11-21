import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
  },
  transformIgnorePatterns: ['/node_modules/(?!(@measured/puck|@dnd-kit|@preact)/)'],
  setupFilesAfterEnv: ['<rootDir>/src/test/setupTests.ts']
};

export default config;

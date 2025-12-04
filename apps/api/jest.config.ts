import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testMatch: ['**/?(*.)+(spec|test).ts'],
  coverageDirectory: '../coverage/apps/api',
  testPathIgnorePatterns: ['/dist/', '/node_modules/'],
  moduleNameMapper: {
    '^@buildweaver/(.*)$': '<rootDir>/../../packages/$1/src'
  }
};

export default config;

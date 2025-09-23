/**
 * Contract Tests for Test Runs API
 * These tests validate the existing API behavior that the frontend visualizations depend on
 * Note: These tests will FAIL initially - they document expected behavior for future API validation
 */

const { expect } = require('chai');
const axios = require('axios');

// Configuration
const API_BASE_URL = process.env.VITE_API_URL || 'http://localhost:8000/api';

// Test data expectations based on frontend requirements
describe('Test Runs API Contract', () => {

    describe('GET /test-runs/', () => {
        it('should return test runs with required performance fields', async () => {
            // This test documents what the frontend expects
            const response = await axios.get(`${API_BASE_URL}/test-runs/`, {
                auth: {
                    username: process.env.TEST_USER || 'test',
                    password: process.env.TEST_PASS || 'test'
                }
            });

            expect(response.status).to.equal(200);
            expect(response.data).to.have.property('data');
            expect(Array.isArray(response.data.data)).to.be.true;

            if (response.data.data.length > 0) {
                const testRun = response.data.data[0];

                // Required fields for visualizations
                expect(testRun).to.have.property('id');
                expect(testRun).to.have.property('timestamp');
                expect(testRun).to.have.property('hostname');
                expect(testRun).to.have.property('block_size');
                expect(testRun).to.have.property('read_write_pattern');
                expect(testRun).to.have.property('queue_depth');

                // Performance fields (may be null but should exist)
                expect(testRun).to.have.property('iops');
                expect(testRun).to.have.property('avg_latency');
                expect(testRun).to.have.property('bandwidth');

                // Optional but expected fields
                expect(testRun).to.have.property('drive_model');
                expect(testRun).to.have.property('drive_type');
                expect(testRun).to.have.property('protocol');
                expect(testRun).to.have.property('num_jobs');
                expect(testRun).to.have.property('p95_latency');
                expect(testRun).to.have.property('p99_latency');
            }
        });

        it('should support hostname filtering for host analysis', async () => {
            const response = await axios.get(`${API_BASE_URL}/test-runs/`, {
                params: { hostnames: ['test-host-01'] },
                auth: {
                    username: process.env.TEST_USER || 'test',
                    password: process.env.TEST_PASS || 'test'
                }
            });

            expect(response.status).to.equal(200);
            expect(response.data).to.have.property('data');
            expect(Array.isArray(response.data.data)).to.be.true;

            // All returned records should match the hostname filter
            response.data.data.forEach(testRun => {
                expect(testRun.hostname).to.equal('test-host-01');
            });
        });

        it('should support block size filtering for visualization controls', async () => {
            const response = await axios.get(`${API_BASE_URL}/test-runs/`, {
                params: { block_sizes: ['4K'] },
                auth: {
                    username: process.env.TEST_USER || 'test',
                    password: process.env.TEST_PASS || 'test'
                }
            });

            expect(response.status).to.equal(200);
            expect(response.data).to.have.property('data');

            response.data.data.forEach(testRun => {
                expect(testRun.block_size).to.equal('4K');
            });
        });

        it('should return paginated results with total count', async () => {
            const response = await axios.get(`${API_BASE_URL}/test-runs/`, {
                params: { limit: 10, offset: 0 },
                auth: {
                    username: process.env.TEST_USER || 'test',
                    password: process.env.TEST_PASS || 'test'
                }
            });

            expect(response.status).to.equal(200);
            expect(response.data).to.have.property('data');
            expect(response.data).to.have.property('total');
            expect(response.data).to.have.property('limit');
            expect(response.data).to.have.property('offset');

            expect(response.data.data.length).to.be.at.most(10);
            expect(response.data.limit).to.equal(10);
            expect(response.data.offset).to.equal(0);
        });
    });

    describe('Data Format Validation', () => {
        it('should return valid block size formats', async () => {
            const response = await axios.get(`${API_BASE_URL}/test-runs/`, {
                auth: {
                    username: process.env.TEST_USER || 'test',
                    password: process.env.TEST_PASS || 'test'
                }
            });

            response.data.data.forEach(testRun => {
                if (testRun.block_size) {
                    // Should match pattern like "4K", "64K", "1M", etc.
                    expect(testRun.block_size).to.match(/^\d+[KMGT]?$/i);
                }
            });
        });

        it('should return valid read/write patterns', async () => {
            const validPatterns = ['randread', 'randwrite', 'read', 'write'];

            const response = await axios.get(`${API_BASE_URL}/test-runs/`, {
                auth: {
                    username: process.env.TEST_USER || 'test',
                    password: process.env.TEST_PASS || 'test'
                }
            });

            response.data.data.forEach(testRun => {
                if (testRun.read_write_pattern) {
                    expect(validPatterns).to.include(testRun.read_write_pattern);
                }
            });
        });

        it('should return numeric performance values where present', async () => {
            const response = await axios.get(`${API_BASE_URL}/test-runs/`, {
                auth: {
                    username: process.env.TEST_USER || 'test',
                    password: process.env.TEST_PASS || 'test'
                }
            });

            response.data.data.forEach(testRun => {
                if (testRun.iops !== null && testRun.iops !== undefined) {
                    expect(testRun.iops).to.be.a('number');
                    expect(testRun.iops).to.be.at.least(0);
                }

                if (testRun.bandwidth !== null && testRun.bandwidth !== undefined) {
                    expect(testRun.bandwidth).to.be.a('number');
                    expect(testRun.bandwidth).to.be.at.least(0);
                }

                if (testRun.avg_latency !== null && testRun.avg_latency !== undefined) {
                    expect(testRun.avg_latency).to.be.a('number');
                    expect(testRun.avg_latency).to.be.greaterThan(0);
                }
            });
        });
    });

    describe('Error Handling', () => {
        it('should return 401 for unauthenticated requests', async () => {
            try {
                await axios.get(`${API_BASE_URL}/test-runs/`);
                expect.fail('Should have thrown 401 error');
            } catch (error) {
                expect(error.response.status).to.equal(401);
            }
        });

        it('should handle invalid filter parameters gracefully', async () => {
            // Test with invalid hostname filter
            const response = await axios.get(`${API_BASE_URL}/test-runs/`, {
                params: { hostnames: ['non-existent-host'] },
                auth: {
                    username: process.env.TEST_USER || 'test',
                    password: process.env.TEST_PASS || 'test'
                }
            });

            expect(response.status).to.equal(200);
            expect(response.data).to.have.property('data');
            expect(Array.isArray(response.data.data)).to.be.true;
            // Should return empty array, not error
            expect(response.data.data.length).to.equal(0);
        });
    });
});

/**
 * Note: These contract tests document the expected API behavior for the frontend visualizations.
 * They will fail initially but serve as documentation and validation criteria.
 * The frontend implementation must work with whatever the actual API returns.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import HostAnalysis from '../HostAnalysis.vue';
// Mock composables
const mockUseAuth = vi.fn();
const mockUseApi = vi.fn();
const mockUseHostSelection = vi.fn();
describe('Integration Test: HostAnalysis Page - Host Selection Persistence', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });
    it('should persist host selections across page navigation', async () => {
        // This test MUST FAIL initially (TDD requirement)
        const mockHostSelectionState = {
            selected: ['server-01', 'server-02'],
            available: ['server-01', 'server-02', 'server-03'],
            persisted: true,
            selectHosts: vi.fn(),
            toggleHost: vi.fn(),
            clearSelection: vi.fn(),
            loadFromStorage: vi.fn(),
            saveToStorage: vi.fn(),
        };
        const mockTestRuns = [
            {
                id: 1,
                hostname: 'server-01',
                drive_model: 'Samsung SSD',
                block_size: '4K',
                read_write_pattern: 'randread',
                iops: 1000,
                avg_latency: 0.5,
            },
            {
                id: 2,
                hostname: 'server-02',
                drive_model: 'WD Black',
                block_size: '4K',
                read_write_pattern: 'randread',
                iops: 1100,
                avg_latency: 0.6,
            },
        ];
        const mockApiState = {
            testRuns: { value: { data: mockTestRuns, loading: false, error: null } },
            filters: { value: { data: null, loading: false, error: null } },
            fetchTestRuns: vi.fn().mockResolvedValue(mockTestRuns),
            fetchFilters: vi.fn(),
            isLoading: { value: false },
            hasError: { value: false },
        };
        mockUseHostSelection.mockReturnValue(mockHostSelectionState);
        mockUseAuth.mockReturnValue({
            isAuthenticated: { value: true },
            user: { value: { username: 'admin', role: 'admin', permissions: [] } },
            hasPermission: vi.fn().mockReturnValue(true),
        });
        mockUseApi.mockReturnValue(mockApiState);
        vi.doMock('@/composables/useHostSelection', () => ({ useHostSelection: mockUseHostSelection }));
        vi.doMock('@/composables/useAuth', () => ({ useAuth: mockUseAuth }));
        vi.doMock('@/composables/useApi', () => ({ useApi: mockUseApi }));
        // This will fail because HostAnalysis component doesn't exist yet
        const wrapper = mount(HostAnalysis, {
            global: {
                plugins: [createTestingPinia()],
                stubs: ['RouterLink', 'HostSelector', 'FilterSidebar', 'PerformanceHeatmap', 'VisualizationTabs'],
            },
        });
        // Verify host selection component exists
        const hostSelector = wrapper.findComponent({ name: 'HostSelector' });
        expect(hostSelector.exists()).toBe(true);
        // Verify initial host selection
        expect(mockHostSelectionState.selected).toEqual(['server-01', 'server-02']);
        // Simulate navigation away and back (component remount)
        wrapper.unmount();
        mount(HostAnalysis, {
            global: {
                plugins: [createTestingPinia()],
                stubs: ['RouterLink', 'HostSelector', 'FilterSidebar', 'PerformanceHeatmap', 'VisualizationTabs'],
            },
        });
        // Verify host selection was loaded from storage
        expect(mockHostSelectionState.loadFromStorage).toHaveBeenCalled();
        expect(mockHostSelectionState.selected).toEqual(['server-01', 'server-02']);
        expect(mockHostSelectionState.persisted).toBe(true);
    });
    it('should save host selections to localStorage', async () => {
        const mockHostSelectionState = {
            selected: [],
            available: ['server-01', 'server-02', 'server-03'],
            persisted: false,
            selectHosts: vi.fn(),
            toggleHost: vi.fn(),
            clearSelection: vi.fn(),
            loadFromStorage: vi.fn(),
            saveToStorage: vi.fn(),
        };
        const mockApiState = {
            testRuns: { value: { data: [], loading: false, error: null } },
            filters: { value: { data: null, loading: false, error: null } },
            fetchTestRuns: vi.fn().mockResolvedValue([]),
            fetchFilters: vi.fn(),
            isLoading: { value: false },
            hasError: { value: false },
        };
        mockUseHostSelection.mockReturnValue(mockHostSelectionState);
        mockUseAuth.mockReturnValue({
            isAuthenticated: { value: true },
            user: { value: { username: 'admin', role: 'admin', permissions: [] } },
            hasPermission: vi.fn().mockReturnValue(true),
        });
        mockUseApi.mockReturnValue(mockApiState);
        vi.doMock('@/composables/useHostSelection', () => ({ useHostSelection: mockUseHostSelection }));
        vi.doMock('@/composables/useAuth', () => ({ useAuth: mockUseAuth }));
        vi.doMock('@/composables/useApi', () => ({ useApi: mockUseApi }));
        const wrapper = mount(HostAnalysis, {
            global: {
                plugins: [createTestingPinia()],
                stubs: ['RouterLink', 'HostSelector', 'FilterSidebar', 'PerformanceHeatmap', 'VisualizationTabs'],
            },
        });
        // Simulate host selection
        const hostSelector = wrapper.findComponent({ name: 'HostSelector' });
        await hostSelector.vm.$emit('selection-change', ['server-01', 'server-03']);
        // Verify saveToStorage was called
        expect(mockHostSelectionState.saveToStorage).toHaveBeenCalled();
        expect(mockHostSelectionState.selected).toEqual(['server-01', 'server-03']);
        // Verify localStorage was updated
        const stored = localStorage.getItem('fio-host-selection');
        expect(stored).toBeTruthy();
        if (stored) {
            const parsed = JSON.parse(stored);
            expect(parsed.selected).toEqual(['server-01', 'server-03']);
            expect(parsed.timestamp).toBeDefined();
        }
    });
    it('should filter data by selected hosts', async () => {
        const mockHostSelectionState = {
            selected: ['server-01'],
            available: ['server-01', 'server-02'],
            persisted: true,
            selectHosts: vi.fn(),
            toggleHost: vi.fn(),
            clearSelection: vi.fn(),
            loadFromStorage: vi.fn(),
            saveToStorage: vi.fn(),
        };
        const mockTestRuns = [
            { id: 1, hostname: 'server-01', iops: 1000 },
            { id: 2, hostname: 'server-02', iops: 1100 },
            { id: 3, hostname: 'server-01', iops: 900 },
        ];
        const mockApiState = {
            testRuns: { value: { data: mockTestRuns, loading: false, error: null } },
            filters: { value: { data: null, loading: false, error: null } },
            fetchTestRuns: vi.fn().mockResolvedValue(mockTestRuns),
            fetchFilters: vi.fn(),
            isLoading: { value: false },
            hasError: { value: false },
        };
        mockUseHostSelection.mockReturnValue(mockHostSelectionState);
        mockUseAuth.mockReturnValue({
            isAuthenticated: { value: true },
            user: { value: { username: 'admin', role: 'admin', permissions: [] } },
            hasPermission: vi.fn().mockReturnValue(true),
        });
        mockUseApi.mockReturnValue(mockApiState);
        vi.doMock('@/composables/useHostSelection', () => ({ useHostSelection: mockUseHostSelection }));
        vi.doMock('@/composables/useAuth', () => ({ useAuth: mockUseAuth }));
        vi.doMock('@/composables/useApi', () => ({ useApi: mockUseApi }));
        const wrapper = mount(HostAnalysis, {
            global: {
                plugins: [createTestingPinia()],
                stubs: ['RouterLink', 'HostSelector', 'FilterSidebar', 'PerformanceHeatmap', 'VisualizationTabs'],
            },
        });
        // Verify API was called with host filter
        expect(mockApiState.fetchTestRuns).toHaveBeenCalledWith({
            hostnames: 'server-01'
        });
        // Verify visualizations receive filtered data
        const heatmap = wrapper.findComponent({ name: 'PerformanceHeatmap' });
        expect(heatmap.props().testRuns).toHaveLength(2); // Only server-01 data
        expect(heatmap.props().testRuns.every(run => run.hostname === 'server-01')).toBe(true);
    });
    it('should handle multi-host selection changes', async () => {
        const mockHostSelectionState = {
            selected: ['server-01'],
            available: ['server-01', 'server-02', 'server-03'],
            persisted: true,
            selectHosts: vi.fn(),
            toggleHost: vi.fn(),
            clearSelection: vi.fn(),
            loadFromStorage: vi.fn(),
            saveToStorage: vi.fn(),
        };
        const mockApiState = {
            testRuns: { value: { data: [], loading: false, error: null } },
            filters: { value: { data: null, loading: false, error: null } },
            fetchTestRuns: vi.fn().mockResolvedValue([]),
            fetchFilters: vi.fn(),
            isLoading: { value: false },
            hasError: { value: false },
        };
        mockUseHostSelection.mockReturnValue(mockHostSelectionState);
        mockUseAuth.mockReturnValue({
            isAuthenticated: { value: true },
            user: { value: { username: 'admin', role: 'admin', permissions: [] } },
            hasPermission: vi.fn().mockReturnValue(true),
        });
        mockUseApi.mockReturnValue(mockApiState);
        vi.doMock('@/composables/useHostSelection', () => ({ useHostSelection: mockUseHostSelection }));
        vi.doMock('@/composables/useAuth', () => ({ useAuth: mockUseAuth }));
        vi.doMock('@/composables/useApi', () => ({ useApi: mockUseApi }));
        const wrapper = mount(HostAnalysis, {
            global: {
                plugins: [createTestingPinia()],
                stubs: ['RouterLink', 'HostSelector', 'FilterSidebar', 'PerformanceHeatmap', 'VisualizationTabs'],
            },
        });
        // Change host selection
        const hostSelector = wrapper.findComponent({ name: 'HostSelector' });
        await hostSelector.vm.$emit('selection-change', ['server-01', 'server-02', 'server-03']);
        // Verify selection changed and was saved
        expect(mockHostSelectionState.saveToStorage).toHaveBeenCalled();
        expect(mockHostSelectionState.selected).toEqual(['server-01', 'server-02', 'server-03']);
        // Verify API was called with new filter
        expect(mockApiState.fetchTestRuns).toHaveBeenCalledWith({
            hostnames: 'server-01,server-02,server-03'
        });
    });
    it('should clear host selection on logout', async () => {
        const mockHostSelectionState = {
            selected: ['server-01', 'server-02'],
            available: ['server-01', 'server-02', 'server-03'],
            persisted: true,
            selectHosts: vi.fn(),
            toggleHost: vi.fn(),
            clearSelection: vi.fn(),
            loadFromStorage: vi.fn(),
            saveToStorage: vi.fn(),
        };
        mockUseHostSelection.mockReturnValue(mockHostSelectionState);
        mockUseAuth.mockReturnValue({
            isAuthenticated: { value: false }, // Simulate logout
            user: { value: null },
            hasPermission: vi.fn().mockReturnValue(false),
        });
        vi.doMock('@/composables/useHostSelection', () => ({ useHostSelection: mockUseHostSelection }));
        vi.doMock('@/composables/useAuth', () => ({ useAuth: mockUseAuth }));
        // Simulate page access after logout
        mount(HostAnalysis, {
            global: {
                plugins: [createTestingPinia()],
                stubs: ['RouterLink', 'HostSelector', 'FilterSidebar', 'PerformanceHeatmap', 'VisualizationTabs'],
            },
        });
        // Verify host selection was cleared
        expect(mockHostSelectionState.clearSelection).toHaveBeenCalled();
        expect(mockHostSelectionState.selected).toEqual([]);
        expect(mockHostSelectionState.persisted).toBe(false);
        // Verify localStorage was cleared
        const stored = localStorage.getItem('fio-host-selection');
        expect(stored).toBeNull();
    });
    it('should handle empty host selection', async () => {
        const mockHostSelectionState = {
            selected: [],
            available: ['server-01', 'server-02'],
            persisted: true,
            selectHosts: vi.fn(),
            toggleHost: vi.fn(),
            clearSelection: vi.fn(),
            loadFromStorage: vi.fn(),
            saveToStorage: vi.fn(),
        };
        const mockApiState = {
            testRuns: { value: { data: [], loading: false, error: null } },
            filters: { value: { data: null, loading: false, error: null } },
            fetchTestRuns: vi.fn().mockResolvedValue([]),
            fetchFilters: vi.fn(),
            isLoading: { value: false },
            hasError: { value: false },
        };
        mockUseHostSelection.mockReturnValue(mockHostSelectionState);
        mockUseAuth.mockReturnValue({
            isAuthenticated: { value: true },
            user: { value: { username: 'admin', role: 'admin', permissions: [] } },
            hasPermission: vi.fn().mockReturnValue(true),
        });
        mockUseApi.mockReturnValue(mockApiState);
        vi.doMock('@/composables/useHostSelection', () => ({ useHostSelection: mockUseHostSelection }));
        vi.doMock('@/composables/useAuth', () => ({ useAuth: mockUseAuth }));
        vi.doMock('@/composables/useApi', () => ({ useApi: mockUseApi }));
        const wrapper = mount(HostAnalysis, {
            global: {
                plugins: [createTestingPinia()],
                stubs: ['RouterLink', 'HostSelector', 'FilterSidebar', 'PerformanceHeatmap', 'VisualizationTabs'],
            },
        });
        // Verify empty state message
        expect(wrapper.text()).toContain('No hosts selected');
        expect(wrapper.text()).toContain('Please select at least one host to view analysis');
        // Verify visualizations show empty state
        const heatmap = wrapper.findComponent({ name: 'PerformanceHeatmap' });
        expect(heatmap.props().testRuns).toHaveLength(0);
    });
});

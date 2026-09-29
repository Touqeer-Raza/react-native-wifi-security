import type TestRenderer from 'react-test-renderer';

import { type NativeMock, cellular, createNativeMock, loadPackage, status } from './helpers';

type Renderer = typeof TestRenderer;

let renderer: Renderer;
let act: Renderer['act'];
let Text: typeof import('react-native').Text;
let useEffect: typeof import('react').useEffect;

/** Loads the package, then React, the renderer and react-native from the same fresh module registry */
const setup = (native: NativeMock) => {
  const pkg = loadPackage(native);
  renderer = require('react-test-renderer');
  act = renderer.act;
  Text = require('react-native').Text;
  useEffect = require('react').useEffect;
  return pkg;
};

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const findGate = (tree: TestRenderer.ReactTestRenderer) => tree.root.findAll((n) => n.props.testID === 'OpenWifiGuard.gate');
const findApp = (tree: TestRenderer.ReactTestRenderer) => tree.root.findAll((n) => n.props.testID === 'app');

describe('<OpenWifiGuard>', () => {
  it('holds the app until the first check says SAFE', async () => {
    const native = createNativeMock(cellular());
    const { OpenWifiGuard } = setup(native);
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <OpenWifiGuard renderWhileChecking={() => <Text testID="splash">…</Text>}>
          <Text testID="app">App</Text>
        </OpenWifiGuard>,
      );
    });
    expect(findApp(tree)).toHaveLength(0);
    expect(tree.root.findAll((n) => n.props.testID === 'splash').length).toBeGreaterThan(0);
    await flush();
    expect(findApp(tree).length).toBeGreaterThan(0);
    expect(findGate(tree)).toHaveLength(0);
  });

  it('shows only the gate on a cold start on open Wi-Fi', async () => {
    const native = createNativeMock(status({ wifiSecurity: 'OPEN' }));
    const { OpenWifiGuard } = setup(native);
    const onBlockedChange = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <OpenWifiGuard onBlockedChange={onBlockedChange}>
          <Text testID="app">App</Text>
        </OpenWifiGuard>,
      );
    });
    await flush();
    expect(findGate(tree).length).toBeGreaterThan(0);
    expect(findApp(tree)).toHaveLength(0);
    expect(onBlockedChange).toHaveBeenCalledWith(true, expect.objectContaining({ state: 'UNSAFE' }));
  });

  it('keeps the app mounted under the gate when the network turns unsafe later', async () => {
    const native = createNativeMock(cellular());
    const pkg = setup(native);
    const mounts = jest.fn();
    const App = () => {
      useEffect(() => mounts(), []);
      return <Text testID="app">App</Text>;
    };
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <pkg.OpenWifiGuard>
          <App />
        </pkg.OpenWifiGuard>,
      );
    });
    await flush();
    expect(mounts).toHaveBeenCalledTimes(1);

    native.setNext(status({ wifiSecurity: 'OPEN' }));
    await act(async () => {
      await pkg.check();
    });
    expect(findGate(tree).length).toBeGreaterThan(0);
    expect(findApp(tree).length).toBeGreaterThan(0);

    native.setNext(status({ wifiSecurity: 'PERSONAL' }));
    await act(async () => {
      await pkg.check();
    });
    expect(findGate(tree)).toHaveLength(0);
    expect(mounts).toHaveBeenCalledTimes(1);
  });

  it('uses custom messages and renderGate', async () => {
    const native = createNativeMock(status({ wifiSecurity: 'OPEN' }));
    const { OpenWifiGuard } = setup(native);
    const messages = { unsafeTitle: 'Custom unsafe title' };
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <OpenWifiGuard messages={messages}>
          <Text>App</Text>
        </OpenWifiGuard>,
      );
    });
    await flush();
    expect(JSON.stringify(tree.toJSON())).toContain(messages.unsafeTitle);

    act(() => {
      tree.update(
        <OpenWifiGuard renderGate={(guard) => <Text testID="custom">{guard.state}</Text>}>
          <Text>App</Text>
        </OpenWifiGuard>,
      );
    });
    expect(tree.root.findByProps({ testID: 'custom' }).props.children).toBe('UNSAFE');
  });

  it('renders the app directly in monitor mode', async () => {
    const native = createNativeMock(status({ wifiSecurity: 'OPEN' }));
    const { OpenWifiGuard } = setup(native);
    const onStateChange = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <OpenWifiGuard mode="monitor" onStateChange={onStateChange}>
          <Text testID="app">App</Text>
        </OpenWifiGuard>,
      );
    });
    expect(findApp(tree).length).toBeGreaterThan(0);
    await flush();
    expect(findGate(tree)).toHaveLength(0);
    expect(onStateChange).toHaveBeenCalledWith(expect.objectContaining({ state: 'UNSAFE' }));
  });

  it('installs the axios guard from props', async () => {
    const native = createNativeMock(status({ wifiSecurity: 'OPEN' }));
    const pkg = setup(native);
    const use = jest.fn(() => 1);
    const eject = jest.fn();
    const api = { interceptors: { request: { use, eject } } };
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <pkg.OpenWifiGuard axiosInstances={[api]}>
          <Text>App</Text>
        </pkg.OpenWifiGuard>,
      );
    });
    expect(use).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
    expect(eject).toHaveBeenCalledWith(1);
  });
});

import UIKit
import Capacitor

class AFFiNEViewController: CAPBridgeViewController {

  override func viewDidLoad() {
    super.viewDidLoad()
    webView?.allowsBackForwardNavigationGestures = true
  }

  override open func capacitorDidLoad() {
    bridge?.registerPluginInstance(HashcashPlugin())
  }
}

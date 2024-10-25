import Capacitor
import CryptoKit

@objc(HashcashPlugin)
public class HashcashPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HashcashPlugin"
    public let jsName = "Hashcash"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "hash", returnType: CAPPluginReturnPromise)
    ]

    @objc func hash(_ call: CAPPluginCall) {
        let challenge = call.getString("challenge") ?? ""
        let bits = call.getInt("bits") ?? 20;
      call.resolve(["value": Stamp.mint(resource: challenge, bits: UInt32(bits)).format()])
    }
}

let SALT_LENGTH = 16

struct Stamp {
    let version: String
    let claim: UInt32
    let ts: String
    let resource: String
    let ext: String
    let rand: String
    let counter: String
    
    func checkExpiration() -> Bool {
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyyMMddHHmmss"
        guard let date = dateFormatter.date(from: ts) else { return false }
        return Date().addingTimeInterval(5 * 60) <= date
    }
    
    func check(bits: UInt32, resource: String) -> Bool {
        if version == "1" && bits <= claim && checkExpiration() && self.resource == resource {
            let hexDigits = Int(floor(Float(claim) / 4.0))
            
            // Check challenge
            let formatted = format()
            let hashed = SHA256.hash(data: formatted.data(using: .utf8)!)
            let result = hashed.compactMap { String(format: "%02x", $0) }.joined()
            return result.prefix(hexDigits) == String(repeating: "0", count: hexDigits)
        } else {
            return false
        }
    }
    
    func format() -> String {
        return "\(version):\(claim):\(ts):\(resource):\(ext):\(rand):\(counter)"
    }
    
    static func mint(resource: String, bits: UInt32? = nil) -> Stamp {
        let version = "1"
        let now = Date()
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyyMMddHHmmss"
        let ts = dateFormatter.string(from: now)
        let bits = bits ?? 20
        let rand = String((0..<SALT_LENGTH).map { _ in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".randomElement()! })
        let challenge = "\(version):\(bits):\(ts):\(resource)::\(rand)"
        
        let hexDigits = Int(ceil(Float(bits) / 4.0))
        let zeros = String(repeating: "0", count: hexDigits)
        var counter = 0
        var counterHex = ""
        
        while true {
            let toHash = "\(challenge):\(String(format: "%x", counter))"
            let hashed = SHA256.hash(data: toHash.data(using: .utf8)!)
            let result = hashed.compactMap { String(format: "%02x", $0) }.joined()
            
            if result.prefix(hexDigits) == zeros {
                counterHex = String(format: "%x", counter)
                break
            }
            counter += 1
        }
        
        return Stamp(version: version, claim: bits, ts: ts, resource: resource, ext: "", rand: rand, counter: counterHex)
    }
}

extension Stamp {
    init?(from string: String) throws {
        let parts = string.split(separator: ":")
        guard parts.count == 7 else {
            throw NSError(domain: "StampError", code: 0, userInfo: [NSLocalizedDescriptionKey: "Malformed stamp, expected 7 parts, got \(parts.count)"])
        }
        
        guard let claim = UInt32(parts[1]) else {
            throw NSError(domain: "StampError", code: 1, userInfo: [NSLocalizedDescriptionKey: "Malformed stamp"])
        }
        
        self.version = String(parts[0])
        self.claim = claim
        self.ts = String(parts[2])
        self.resource = String(parts[3])
        self.ext = String(parts[4])
        self.rand = String(parts[5])
        self.counter = String(parts[6])
    }
}

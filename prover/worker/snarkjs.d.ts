declare module 'snarkjs' {
  export namespace groth16 {
    export function fullProve(
      input: unknown,
      wasmFile: string,
      zkeyFile: string
    ): Promise<{
      proof: unknown;
      publicSignals: unknown;
    }>;

    export function verify(
      vkey: unknown,
      publicSignals: unknown,
      proof: unknown
    ): Promise<boolean>;
  }

  export namespace zKey {
    export function exportVerificationKey(zkeyFile: string): Promise<unknown>;
  }
}

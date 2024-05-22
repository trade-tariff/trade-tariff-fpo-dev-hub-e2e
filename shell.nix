{ pkgs ? import <nixpkgs> {} }:
pkgs.mkShell {
  nativeBuildInputs = with pkgs; [
    playwright-driver.browsers
    nodejs_21
  ];

  shellHook = ''
    export PLAYWRIGHT_BROWSERS_PATH=${pkgs.playwright-driver.browsers.outPath};
    export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true;
  '';
}

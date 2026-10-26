{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    pre-commit-hooks = {
      url = "github:cachix/git-hooks.nix";
    };
  };

  outputs =
    {
      nixpkgs,
      flake-utils,
      pre-commit-hooks,
      ...
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config.allowUnfree = true;
        };

        reviewTools = import (builtins.fetchTree {
          type = "github";
          owner = "NixOS";
          repo = "nixpkgs";
          rev = "4a29d733e8a7d5b824c3d8c958a946a9867b3eb2";
          narHash = "sha256-f+JACbTqzZ+G92DSnXOUGRhGANb8Blh7CoeYOeBF8/U=";
        }) { inherit system; };
        reviewSecretTools = import (builtins.fetchTree {
          type = "github";
          owner = "NixOS";
          repo = "nixpkgs";
          rev = "7525d999cd850b9a488817abc89c75dc733acf17";
          narHash = "sha256-4IHyyLgLBdKefkljdKod4IMn023pQiDXAWJA187cmdY=";
        }) { inherit system; };
        reviewPreCommitConfig = pkgs.writeText "review-pre-commit.json" (
          builtins.toJSON {
            repos = [
              {
                repo = "local";
                hooks = [
                  {
                    id = "trailing-whitespace";
                    name = "trim trailing whitespace";
                    language = "system";
                    entry = "${reviewTools.python3Packages.pre-commit-hooks}/bin/trailing-whitespace-fixer";
                    types = [ "text" ];
                    stages = [
                      "pre-commit"
                      "pre-push"
                      "manual"
                    ];
                  }
                  {
                    id = "end-of-file-fixer";
                    name = "fix end of files";
                    language = "system";
                    entry = "${reviewTools.python3Packages.pre-commit-hooks}/bin/end-of-file-fixer";
                    types = [ "text" ];
                    stages = [
                      "pre-commit"
                      "pre-push"
                      "manual"
                    ];
                  }
                  {
                    id = "check-yaml";
                    name = "check yaml";
                    language = "system";
                    entry = "${reviewTools.python3Packages.pre-commit-hooks}/bin/check-yaml";
                    types = [ "yaml" ];
                  }
                  {
                    id = "check-merge-conflict";
                    name = "check for merge conflicts";
                    language = "system";
                    entry = "${reviewTools.python3Packages.pre-commit-hooks}/bin/check-merge-conflict";
                    types = [ "text" ];
                  }
                  {
                    id = "file-contents-sorter";
                    name = "file contents sorter";
                    language = "system";
                    entry = "${reviewTools.python3Packages.pre-commit-hooks}/bin/file-contents-sorter";
                    files = ".env.development|.env.staging|.env.production";
                  }
                  {
                    id = "actionlint-docker";
                    name = "Lint GitHub Actions workflow files";
                    language = "system";
                    entry = "${reviewTools.actionlint}/bin/actionlint";
                    types = [ "yaml" ];
                    files = "^\\.github/workflows/";
                  }
                  {
                    id = "trufflehog";
                    name = "TruffleHog";
                    language = "system";
                    entry = "${reviewSecretTools.trufflehog}/bin/trufflehog git file://. --since-commit HEAD --results=verified --fail --trust-local-git-config";
                    pass_filenames = false;
                  }
                ];
              }
            ];
          }
        );
        reviewEnvironment = ''
          if [ "''${REVIEW_SANDBOX:-}" != 1 ] || [ "$PWD" != /workspace ]; then exit 64; fi
          export TMPDIR=/workspace/.review/tmp PRE_COMMIT_HOME=/workspace/.review/pre-commit
          export npm_config_ignore_scripts=true YARN_IGNORE_SCRIPTS=true YARN_OFFLINE=true YARN_CACHE_FOLDER="$TMPDIR/yarn-cache"
          export CI=true AWS_EC2_METADATA_DISABLED=true
          mkdir -p "$TMPDIR"
        '';

        preCommitCheck = pre-commit-hooks.lib.${system}.run {
          src = ./.;
          configPath = ".pre-commit-config-nix.yaml";
          default_stages = [ "pre-commit" ];
          hooks = {
            actionlint = {
              enable = true;
              stages = [ "pre-commit" ];
            };
            check-added-large-files = {
              enable = true;
              stages = [ "pre-commit" ];
            };
            check-case-conflicts = {
              enable = true;
              stages = [ "pre-commit" ];
            };
            check-merge-conflicts = {
              enable = true;
              stages = [ "pre-commit" ];
            };
            check-yaml = {
              enable = true;
              stages = [ "pre-commit" ];
            };
            deadnix = {
              enable = true;
              stages = [ "pre-commit" ];
            };
            detect-private-keys = {
              enable = true;
              stages = [ "pre-commit" ];
            };
            end-of-file-fixer = {
              enable = true;
              stages = [ "pre-commit" ];
            };
            eslint = {
              enable = true;
              settings.binPath = "./node_modules/.bin/eslint";
              settings.extensions = "\\.ts$";
              stages = [ "pre-commit" ];
            };
            nixfmt-rfc-style = {
              package = pre-commit-hooks.inputs.nixpkgs.legacyPackages.${system}.nixfmt;
              enable = true;
              stages = [ "pre-commit" ];
            };
            sort-file-contents = {
              enable = true;
              files = "^\\.env\\.(development|example|staging|production)$";
              stages = [ "pre-commit" ];
            };
            statix = {
              enable = true;
              settings.ignore = [ "{.direnv,.nix,.worktrees}/**" ];
              stages = [ "pre-commit" ];
            };
            trim-trailing-whitespace = {
              enable = true;
              stages = [ "pre-commit" ];
            };
            trufflehog = {
              enable = true;
              stages = [ "pre-commit" ];
            };
          };
        };
      in
      {
        devShells.review = pkgs.mkShell {
          shellHook = "";
          nativeBuildInputs = [
            pkgs.gitMinimal
            reviewTools.pre-commit
            pkgs.nodejs_latest
            pkgs.yarn
            pkgs.coreutils
            pkgs.gnugrep
            pkgs.gnused
            (pkgs.writeShellApplication {
              name = "review-bootstrap";
              text = reviewEnvironment + ''
                printf 'yarn-offline-mirror "/deps/yarn-archives"\n' > "$TMPDIR/yarnrc"
                yarn --use-yarnrc "$TMPDIR/yarnrc" install --offline --frozen-lockfile --ignore-scripts
              '';
            })
            (pkgs.writeShellApplication {
              name = "review-check";
              text = reviewEnvironment + ''
                status=0
                pre-commit run --all-files --config ${reviewPreCommitConfig} || status=$?
                yarn lint || status=$?
                yarn typecheck || status=$?
                if [ "$status" -ne 0 ]; then exit "$status"; fi
                echo 'Blocked: browser scenarios require the shared dev hub, Identity login and authorised service credentials.' >&2
                exit 78
              '';
            })
          ];
          TZDIR = "${pkgs.tzdata.outPath}/share/zoneinfo";
          SSL_CERT_FILE = "${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt";
        };

        devShells.default = pkgs.mkShell {
          shellHook = ''
            export PLAYWRIGHT_BROWSERS_PATH=${pkgs.playwright-driver.browsers.outPath};
            export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true;
            ${preCommitCheck.shellHook}
            export PATH=${pkgs.writeShellScriptBin "pre-commit" ''
              set -euo pipefail

              has_config=false
              for arg in "$@"; do
                case "$arg" in
                  -c|--config|--config=*)
                    has_config=true
                    ;;
                esac
              done

              if [ "$has_config" = true ]; then
                exec ${preCommitCheck.config.package}/bin/pre-commit "$@"
              fi

              if [ "''${1:-}" = "run" ]; then
                shift
                exec ${preCommitCheck.config.package}/bin/pre-commit run --config .pre-commit-config-nix.yaml "$@"
              fi

              exec ${preCommitCheck.config.package}/bin/pre-commit "$@"
            ''}/bin:$PATH
          '';

          buildInputs =
            preCommitCheck.enabledPackages
            ++ (with pkgs; [
              playwright-driver.browsers
              nodejs_latest
              yarn
              python3
            ]);
        };
      }
    );
}

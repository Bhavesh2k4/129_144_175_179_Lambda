#!/bin/bash

set -e

log() {
  echo "[*] $1"
}

check_command() {
  if ! command -v "$1" &> /dev/null; then
    log "Error: Required command '$1' not found. Please install it."
    exit 1
  fi
}

setup_common_binaries() {
  # Get latest Firecracker kernel
  ARCH="$(uname -m)"
  release_url="https://github.com/firecracker-microvm/firecracker/releases"
  latest_version=$(basename $(curl -fsSLI -o /dev/null -w %{url_effective} ${release_url}/latest))
  CI_VERSION=${latest_version%.*}
  
  # Download linux kernel binary
  if ! ls vmlinux-* 1> /dev/null 2>&1; then
    latest_kernel_key=$(curl "http://spec.ccfc.min.s3.amazonaws.com/?prefix=firecracker-ci/$CI_VERSION/$ARCH/vmlinux-&list-type=2" \
      | grep -oP "(?<=<Key>)(firecracker-ci/$CI_VERSION/$ARCH/vmlinux-[0-9]+\.[0-9]+\.[0-9]{1,3})(?=</Key>)" \
      | sort -V | tail -1)
    
    log "Downloading kernel binary..."
    wget "https://s3.amazonaws.com/spec.ccfc.min/${latest_kernel_key}"
  fi
  
  # Download Ubuntu rootfs
  if ! ls ubuntu-*.squashfs.upstream 1> /dev/null 2>&1; then
    latest_ubuntu_key=$(curl "http://spec.ccfc.min.s3.amazonaws.com/?prefix=firecracker-ci/$CI_VERSION/$ARCH/ubuntu-&list-type=2" \
      | grep -oP "(?<=<Key>)(firecracker-ci/$CI_VERSION/$ARCH/ubuntu-[0-9]+\.[0-9]+\.squashfs)(?=</Key>)" \
      | sort -V | tail -1)
    ubuntu_version=$(basename $latest_ubuntu_key .squashfs | grep -oE '[0-9]+\.[0-9]+')
    log "Downloading Ubuntu rootfs..."
    wget -O ubuntu-$ubuntu_version.squashfs.upstream "https://s3.amazonaws.com/spec.ccfc.min/$latest_ubuntu_key"
  else
    ubuntu_version=$(basename $(readlink -f ubuntu-*.squashfs.upstream) | sed -E 's/ubuntu-([0-9]+\.[0-9]+).*/\1/')
  fi
  
  # Download firecracker binary
  if [ ! -f "firecracker" ]; then
    log "Downloading Firecracker binary..."
    ARCH="$(uname -m)"
    release_url="https://github.com/firecracker-microvm/firecracker/releases"
    latest=$(basename $(curl -fsSLI -o /dev/null -w %{url_effective} ${release_url}/latest))
    curl -L ${release_url}/download/${latest}/firecracker-${latest}-${ARCH}.tgz | tar -xz
    mv release-${latest}-$(uname -m)/firecracker-${latest}-${ARCH} firecracker
    chmod +x firecracker
    rm -rf release-${latest}-$(uname -m)
  fi
}

build_image() {
  image_type=$1
  log "Building $image_type image..."
  
  work_dir="$image_type-image"
  mkdir -p "$work_dir"
  
  log "Extracting rootfs for $image_type image..."
  unsquashfs -f -d "$work_dir/squashfs-root" ubuntu-*.squashfs.upstream
  
  # Setup SSH keys
  if [ ! -f "id_rsa" ]; then
    log "Generating SSH keys..."
    ssh-keygen -f id_rsa -N ""
  fi
  
  mkdir -p "$work_dir/squashfs-root/root/.ssh/"
  cp -v id_rsa.pub "$work_dir/squashfs-root/root/.ssh/authorized_keys"

  if [ "$image_type" == "python" ]; then
    log "Setting up Python environment..."
    
    mkdir -p "$work_dir/squashfs-root/usr/local/bin/"
    cp -v ../scripts/execution-agent.py "$work_dir/squashfs-root/usr/local/bin/"
    chmod +x "$work_dir/squashfs-root/usr/local/bin/execution-agent.py"
    
  # elif [ "$image_type" == "nodejs" ]; then
  # TODO
  fi
  
  # Create ext4 filesystem image
  log "Creating filesystem image for $image_type..."
  sudo chown -R root:root "$work_dir/squashfs-root"
  truncate -s 400M "ubuntu-$ubuntu_version-$image_type.ext4"
  sudo mkfs.ext4 -d "$work_dir/squashfs-root" -F "ubuntu-$ubuntu_version-$image_type.ext4"
  sudo rm -rf "$work_dir"
  mv "ubuntu-$ubuntu_version-$image_type.ext4" "$image_type" 
}

# Check prerequisites
log "Checking required commands..."
check_command wget
check_command curl
check_command sudo
check_command mkfs.ext4
check_command unsquashfs
check_command ssh-keygen

mkdir -p ../images
cd ../images

setup_common_binaries
build_image python
# build_image nodejs

log "Build complete! Image details:"
echo "Kernel: $(readlink -f vmlinux-*)"
echo "Python rootfs: ubuntu-$ubuntu_version-python.ext4"
# echo "Node.js rootfs: ubuntu-$ubuntu_version-nodejs.ext4"
echo "SSH Key: id_rsa"
echo "Firecracker binary: $(pwd)/firecracker"

log "All images built successfully!"